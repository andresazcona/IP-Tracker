#!/bin/bash
# INSTALADOR UNIVERSAL PARA RASPBERRY PI - IP PING SERVICE
# Autor: Andres Azcona


set -euo pipefail

# ===== Colores =====
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ===== Utilidades de impresión =====
print_status()  { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# ===== Configuración =====
BACKEND_URL="https://backend-ipservice.vercel.app"
SERVICE_NAME="ip-ping"
INSTALL_DIR="/opt/ip-ping"
LOG_FILE="/var/log/ip-ping.log"

# Variables configurables por el usuario durante la instalación
SERVICE_USER=""
DEVICE_NAME=""

# ===== Checks =====
check_root() {
  if [[ $EUID -ne 0 ]]; then
    print_error "Este script debe ejecutarse como root (usa sudo)"
    print_error "Uso: sudo bash install.sh"
    print_error "  o: curl -sSL https://raw.githubusercontent.com/andresazcona/RosCarritoMovement/main/scripts/install.sh | sudo bash"
    exit 1
  fi
}

check_system() {
  print_status "Verificando sistema..."
  
  # Verificar que es un sistema Linux
  if [[ ! -f /etc/os-release ]]; then
    print_error "Este script solo funciona en sistemas Linux"
    exit 1
  fi
  
  # Verificar arquitectura (ARM para Raspberry Pi)
  local arch=$(uname -m)
  if [[ "$arch" =~ ^(armv6l|armv7l|aarch64|x86_64)$ ]]; then
    print_success "Arquitectura soportada: $arch"
  else
    print_warning "Arquitectura no típica para Raspberry Pi: $arch"
    read -rp "¿Continuar de todas formas? [y/N]: " confirm
    if [[ ! "${confirm:-N}" =~ ^[Yy]$ ]]; then
      print_error "Instalación cancelada"
      exit 1
    fi
  fi
  
  # Verificar conectividad
  if ! curl -s --max-time 10 "$BACKEND_URL/api/devices" >/dev/null 2>&1; then
    print_error "No se puede conectar al servidor: $BACKEND_URL"
    print_error "Verifica tu conexión a internet"
    exit 1
  fi
  
  print_success "Sistema verificado correctamente"
}

# ===== Obtener datos del usuario =====
get_user_config() {
  echo ""
  echo "Configuración del servicio:"
  echo "==========================="

  local default_user
  if id "pi" &>/dev/null; then
    default_user="pi"
  elif [[ -n "${SUDO_USER:-}" ]]; then
    default_user="$SUDO_USER"
  else
    default_user="$(logname 2>/dev/null || echo "$USER")"
  fi

  read -rp "Usuario para el servicio [$default_user]: " input_user
  SERVICE_USER="${input_user:-$default_user}"

  local default_device
  default_device="$(hostname)"
  read -rp "Nombre del dispositivo [$default_device]: " input_device
  DEVICE_NAME="${input_device:-$default_device}"

  echo ""
  echo "Configuración:"
  echo "   - Usuario: $SERVICE_USER"
  echo "   - Dispositivo: $DEVICE_NAME"
  echo "   - Servidor: $BACKEND_URL"
  echo ""
  read -rp "¿Continuar con la instalación? [Y/n]: " confirm
  if [[ "${confirm:-Y}" =~ ^[Nn]$ ]]; then
    print_error "Instalación cancelada por el usuario"
    exit 1
  fi
}

# ===== Dependencias =====
install_dependencies() {
  print_status "Instalando dependencias..."
  apt-get update -qq
  apt-get install -y curl jq systemd network-manager || true
  print_success "Dependencias instaladas"
}

# ===== Directorios =====
create_directories() {
  print_status "Creando directorios..."
  mkdir -p "$INSTALL_DIR"
  mkdir -p "$(dirname "$LOG_FILE")"
  touch "$LOG_FILE"
  if ! chown "$SERVICE_USER:$SERVICE_USER" "$LOG_FILE" 2>/dev/null; then
    print_warning "No se pudo cambiar propietario del log, usando permisos generales"
    chmod 666 "$LOG_FILE"
  fi
  print_success "Directorios creados"
}

# ===== Script de ping =====
create_ping_script() {
  print_status "Creando script de ping..."

  cat > "$INSTALL_DIR/ping-script.sh" <<EOF
#!/bin/bash
set -euo pipefail

BACKEND_URL="$BACKEND_URL"
DEVICE_NAME="$DEVICE_NAME"
LOG_FILE="$LOG_FILE"

log_message() {
  echo "\$(date '+%Y-%m-%d %H:%M:%S') - \$1" >> "\$LOG_FILE"
}

get_local_ip() {
  hostname -I 2>/dev/null | awk '{print \$1}' || ip route get 8.8.8.8 2>/dev/null | grep -Po 'src \K[\\d.]+' || true
}

get_public_ip() {
  curl -s --max-time 10 https://ipinfo.io/ip 2>/dev/null || \
  curl -s --max-time 10 https://icanhazip.com 2>/dev/null || \
  curl -s --max-time 10 https://ifconfig.me 2>/dev/null || true
}

get_mac_address() {
  cat /sys/class/net/*/address 2>/dev/null | grep -v "00:00:00:00:00:00" | head -1 || true
}

get_wifi_info() {
  local wifi_ssid=""
  local wifi_interface=""
  
  # Método 1: nmcli (NetworkManager) - Más confiable
  if command -v nmcli &>/dev/null; then
    wifi_ssid=\$(nmcli -t -f active,ssid dev wifi 2>/dev/null | awk -F: '/^yes:/ {print \$2}' | head -1)
    if [[ -n "\$wifi_ssid" && "\$wifi_ssid" != "--" ]]; then
      echo "\$wifi_ssid"
      return
    fi
    # También intentar con conexiones activas
    wifi_ssid=\$(nmcli -t -f name,type connection show --active 2>/dev/null | awk -F: '/wifi\$/ {print \$1}' | head -1)
    if [[ -n "\$wifi_ssid" ]]; then
      echo "\$wifi_ssid"
      return
    fi
  fi
  
  # Método 2: iwconfig (wireless-tools)
  wifi_interface=\$(iwconfig 2>/dev/null | grep -E "wlan|wlp" | grep "ESSID" | head -1 | awk '{print \$1}')
  if [[ -n "\$wifi_interface" ]]; then
    wifi_ssid=\$(iwconfig "\$wifi_interface" 2>/dev/null | sed -n 's/.*ESSID:"\\([^"]*\\)".*/\\1/p')
    if [[ -n "\$wifi_ssid" && "\$wifi_ssid" != "off/any" ]]; then
      echo "\$wifi_ssid"
      return
    fi
  fi
  
  # Método 3: iw (iw tools)
  if command -v iw &>/dev/null; then
    for interface in \$(ls /sys/class/net/ | grep -E "wlan|wlp"); do
      wifi_ssid=\$(iw dev "\$interface" link 2>/dev/null | awk '/SSID:/ {for(i=2;i<=NF;i++) printf "%s ", \$i; print ""}' | sed 's/ \$//')
      if [[ -n "\$wifi_ssid" ]]; then
        echo "\$wifi_ssid"
        return
      fi
    done
  fi
  
  # Método 4: /proc/net/wireless
  if [[ -f /proc/net/wireless ]]; then
    wifi_interface=\$(awk 'NR>2 {gsub(":",""); print \$1}' /proc/net/wireless | head -1)
    if [[ -n "\$wifi_interface" ]] && command -v iwgetid &>/dev/null; then
      wifi_ssid=\$(iwgetid "\$wifi_interface" -r 2>/dev/null)
      if [[ -n "\$wifi_ssid" ]]; then
        echo "\$wifi_ssid"
        return
      fi
    fi
  fi
  
  # Método 5: Verificar si es conexión Ethernet
  local default_interface=\$(ip route | awk '/default/ {for (i=1;i<=NF;i++) if (\$i=="dev") print \$(i+1); exit}')
  if [[ -n "\$default_interface" ]]; then
    if [[ "\$default_interface" =~ ^(eth|enp|eno) ]]; then
      echo "Ethernet (\$default_interface)"
      return
    elif [[ "\$default_interface" =~ ^(wlan|wlp) ]]; then
      echo "WiFi (\$default_interface)"
      return
    fi
  fi
  
  # Fallback: Desconocida
  echo "Desconocida"
}

register_device() {
  local mac_address=\$(get_mac_address)
  local json_payload=\$(cat <<EOJSON
{
  "device_name": "\$DEVICE_NAME",
  "device_type": "linux_device",
  "mac_address": "\$mac_address",
  "description": "Dispositivo Linux - \$(uname -n) - Auto registrado"
}
EOJSON
)
  log_message "Registrando dispositivo: \$DEVICE_NAME"
  local response=\$(curl -s -w "\\n%{http_code}" -X POST -H "Content-Type: application/json" -d "\$json_payload" --max-time 30 "\$BACKEND_URL/api/devices/register" 2>/dev/null)
  local http_code=\$(echo "\$response" | tail -n1)
  if [[ "\$http_code" == "201" || "\$http_code" == "409" ]]; then
    log_message "Dispositivo registrado - HTTP \$http_code"
    return 0
  else
    log_message "Falló registro - HTTP \$http_code"
    return 1
  fi
}

send_ping() {
  local local_ip=\$(get_local_ip)
  local public_ip=\$(get_public_ip)
  local mac_address=\$(get_mac_address)
  local wifi_network=\$(get_wifi_info)
  local json_payload=\$(cat <<EOJSON
{
  "device_name": "\$DEVICE_NAME",
  "local_ip": "\$local_ip",
  "public_ip": "\$public_ip",
  "mac_address": "\$mac_address",
  "wifi_network": "\$wifi_network",
  "timestamp": "\$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
}
EOJSON
)
  log_message "Enviando ping - Local: \$local_ip, Pública: \$public_ip, Red: \$wifi_network"
  local response=\$(curl -s -w "\\n%{http_code}" -X POST -H "Content-Type: application/json" -H "User-Agent: LinuxDevice-IPPing/1.0" -d "\$json_payload" --max-time 30 "\$BACKEND_URL/api/devices/ping" 2>/dev/null)
  local http_code=\$(echo "\$response" | tail -n1)
  if [[ "\$http_code" == "200" ]]; then
    log_message "Ping enviado exitosamente - HTTP \$http_code"
  elif [[ "\$http_code" == "404" ]]; then
    log_message "Dispositivo no encontrado - HTTP \$http_code. Registrando..."
    if register_device; then
      send_ping
    fi
  else
    log_message "Ping falló - HTTP \$http_code"
  fi
}

if curl -s --max-time 5 https://google.com >/dev/null 2>&1; then
  log_message "Iniciando IP Ping"
  send_ping
  log_message "Ping completado"
else
  log_message "Sin conexión a internet"
  exit 1
fi
EOF

  chmod +x "$INSTALL_DIR/ping-script.sh"
  if ! chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/ping-script.sh" 2>/dev/null; then
    print_warning "No se pudo cambiar propietario del script, usando permisos generales"
    chmod 755 "$INSTALL_DIR/ping-script.sh"
  fi
  print_success "Script de ping creado"
}

# ===== Servicio systemd =====
create_systemd_service() {
  print_status "Creando servicio systemd..."

  cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=IP Ping Service para Raspberry Pi
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/bin/bash $INSTALL_DIR/ping-script.sh
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ip-ping

[Install]
WantedBy=multi-user.target
EOF

  print_success "Servicio systemd creado"
}

# ===== Timer systemd (cada 2 min) =====
create_systemd_timer() {
  print_status "Creando timer systemd..."

  cat > "/etc/systemd/system/${SERVICE_NAME}.timer" <<EOF
[Unit]
Description=Ejecutar IP Ping cada 2 minutos
Requires=${SERVICE_NAME}.service

[Timer]
OnBootSec=30sec
OnUnitActiveSec=2min
Persistent=true

[Install]
WantedBy=timers.target
EOF

  print_success "Timer systemd creado (cada 2 minutos)"
}

# ===== Servicio que dispara al conectarse a la red =====
create_network_service() {
  print_status "Creando servicio de conexión de red..."

  cat > "/etc/systemd/system/${SERVICE_NAME}-network.service" <<EOF
[Unit]
Description=IP Ping al conectarse a la red
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/bin/bash $INSTALL_DIR/ping-script.sh
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ip-ping-network

[Install]
WantedBy=network-online.target
EOF

  # Dispatcher de NetworkManager (si existe)
  if command -v nmcli &>/dev/null; then
    mkdir -p /etc/NetworkManager/dispatcher.d
    cat > "/etc/NetworkManager/dispatcher.d/99-ip-ping" <<'EOF'
#!/bin/bash
# Script que se ejecuta cuando cambia la conexión de red (NetworkManager)

interface="$1"
action="$2"

case "$action" in
  up)
    sleep 5
    systemctl start ip-ping.service
    ;;
esac
EOF
    chmod +x "/etc/NetworkManager/dispatcher.d/99-ip-ping"
    print_success "Script NetworkManager dispatcher creado"
  fi

  print_success "Servicio de conexión de red creado"
}

# ===== Instalación principal =====
main() {
  clear
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}    IP PING SERVICE - INSTALADOR       ${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo -e "${GREEN}Servidor: $BACKEND_URL${NC}"
  echo -e "${GREEN}Versión: 2.0 - Universal${NC}"
  echo ""
  
  check_root
  check_system
  get_user_config
  
  print_status "Iniciando instalación..."
  
  install_dependencies
  create_directories
  create_ping_script
  create_systemd_service
  create_systemd_timer
  create_network_service
  
  # Habilitar y iniciar servicios
  print_status "Configurando servicios..."
  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}.timer"
  systemctl enable "${SERVICE_NAME}-network.service"
  systemctl start "${SERVICE_NAME}.timer"
  systemctl start "${SERVICE_NAME}-network.service"
  
  # Ejecutar ping inicial
  print_status "Ejecutando ping inicial..."
  if systemctl start "$SERVICE_NAME.service"; then
    print_success "Ping inicial ejecutado correctamente"
  else
    print_warning "El ping inicial falló, pero el servicio está configurado"
  fi
  
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}    INSTALACIÓN COMPLETADA             ${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo -e "${BLUE}📋 SERVICIOS INSTALADOS:${NC}"
  echo -e "   • ${SERVICE_NAME}.service (ping único)"
  echo -e "   • ${SERVICE_NAME}.timer (cada 2 minutos)"
  echo -e "   • ${SERVICE_NAME}-network.service (al conectarse)"
  echo ""
  echo -e "${BLUE}📊 COMANDOS ÚTILES:${NC}"
  echo -e "   • Ver logs:     ${YELLOW}sudo journalctl -u $SERVICE_NAME -f${NC}"
  echo -e "   • Estado:       ${YELLOW}sudo systemctl status $SERVICE_NAME.timer${NC}"
  echo -e "   • Ping manual:  ${YELLOW}sudo systemctl start $SERVICE_NAME${NC}"
  echo -e "   • Desinstalar:  ${YELLOW}sudo bash $0 uninstall${NC}"
  echo ""
  echo -e "${BLUE}🌐 VERIFICAR EN:${NC}"
  echo -e "   ${YELLOW}$BACKEND_URL/api/devices${NC}"
  echo ""
  echo -e "${GREEN}✅ El dispositivo '$DEVICE_NAME' ya está enviando pings automáticamente${NC}"
  echo ""
}

# ===== Desinstalar =====
uninstall_service() {
  print_status "Desinstalando IP Ping Service..."
  systemctl stop "${SERVICE_NAME}.timer" 2>/dev/null || true
  systemctl disable "${SERVICE_NAME}.timer" 2>/dev/null || true
  systemctl stop "${SERVICE_NAME}.service" 2>/dev/null || true
  systemctl disable "${SERVICE_NAME}.service" 2>/dev/null || true
  systemctl stop "${SERVICE_NAME}-network.service" 2>/dev/null || true
  systemctl disable "${SERVICE_NAME}-network.service" 2>/dev/null || true
  rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
  rm -f "/etc/systemd/system/${SERVICE_NAME}.timer"
  rm -f "/etc/systemd/system/${SERVICE_NAME}-network.service"
  rm -f "/etc/NetworkManager/dispatcher.d/99-ip-ping"
  rm -rf "$INSTALL_DIR"
  systemctl daemon-reload
  print_success "Servicio desinstalado completamente"
}

# ===== Mostrar estado =====
show_status() {
  echo -e "${BLUE}Estado del IP Ping Service:${NC}"
  echo "============================"
  systemctl status "${SERVICE_NAME}.timer" --no-pager -l 2>/dev/null || echo -e "${RED}Servicio no instalado${NC}"
  echo ""
  echo -e "${BLUE}Últimos logs:${NC}"
  echo "============="
  journalctl -u "${SERVICE_NAME}.service" -n 10 --no-pager 2>/dev/null || echo "No hay logs disponibles"
}

# ===== Prueba manual =====
test_service() {
  if [[ -f "$INSTALL_DIR/ping-script.sh" ]]; then
    print_status "Ejecutando prueba manual..."
    if id "$SERVICE_USER" &>/dev/null 2>&1; then
      sudo -u "$SERVICE_USER" bash "$INSTALL_DIR/ping-script.sh"
    else
      bash "$INSTALL_DIR/ping-script.sh"
    fi
  else
    print_error "Servicio no instalado. Ejecuta: sudo bash $0"
  fi
}

# ===== Ayuda =====
show_help() {
  echo -e "${BLUE}IP Ping Service - Instalador Universal${NC}"
  echo ""
  echo -e "${YELLOW}Uso:${NC}"
  echo "  sudo bash install.sh [comando]"
  echo ""
  echo -e "${YELLOW}Instalación rápida:${NC}"
  echo "  curl -sSL https://raw.githubusercontent.com/andresazcona/RosCarritoMovement/main/scripts/install.sh | sudo bash"
  echo ""
  echo -e "${YELLOW}Comandos disponibles:${NC}"
  echo "  (ninguno)   - Instalar servicio (por defecto)"
  echo "  uninstall   - Desinstalar servicio completamente"
  echo "  status      - Mostrar estado del servicio"
  echo "  test        - Ejecutar prueba manual"
  echo "  help        - Mostrar esta ayuda"
  echo ""
  echo -e "${YELLOW}Ejemplos:${NC}"
  echo "  sudo bash install.sh"
  echo "  sudo bash install.sh status"
  echo "  sudo bash install.sh uninstall"
}

# ===== Menú principal =====
case "${1:-install}" in
  install|"")
    main
    ;;
  uninstall)
    check_root
    uninstall_service
    ;;
  status)
    show_status
    ;;
  test)
    test_service
    ;;
  help|-h|--help)
    show_help
    ;;
  *)
    print_error "Comando desconocido: $1"
    echo ""
    show_help
    exit 1
    ;;
esac
