#!/bin/bash

# Nomad Update Script

###################################################################################################################################################################################################

# Script                | Nomad Update Script
# Version               | 1.0.1
# Author                | Crosstalk Solutions, LLC
# Website               | https://crosstalksolutions.com

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                           Color Codes                                                                                           #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################

RESET='\033[0m'
YELLOW='\033[1;33m'
WHITE_R='\033[39m' # Same as GRAY_R for terminals with white background.
GRAY_R='\033[39m'
RED='\033[1;31m' # Light Red.
GREEN='\033[1;32m' # Light Green.

NOMAD_DIR="${NOMAD_DIR:-/opt/nomad}"
LEGACY_NOMAD_DIR="${LEGACY_NOMAD_DIR:-/opt/project-nomad}"
COMPOSE_PROJECT_NAME="nomad"
LEGACY_COMPOSE_PROJECT_NAME="project-nomad"
LEGACY_MIGRATION_PERFORMED='false'

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                           Functions                                                                                             #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################

check_has_sudo() {
  if sudo -n true 2>/dev/null; then
    echo -e "${GREEN}#${RESET} User has sudo permissions.\\n"
  else
    echo "User does not have sudo permissions"
    header_red
    echo -e "${RED}#${RESET} This script requires sudo permissions to run. Please run the script with sudo.\\n"
    echo -e "${RED}#${RESET} For example: sudo bash $(basename "$0")"
    exit 1
  fi
}

check_is_bash() {
  if [[ -z "$BASH_VERSION" ]]; then
    header_red
    echo -e "${RED}#${RESET} This script requires bash to run. Please run the script using bash.\\n"
    echo -e "${RED}#${RESET} For example: bash $(basename "$0")"
    exit 1
  fi
    echo -e "${GREEN}#${RESET} This script is running in bash.\\n"
}

check_is_debian_based() {
  if [[ ! -f /etc/debian_version ]]; then
    header_red
    echo -e "${RED}#${RESET} This script is designed to run on Debian-based systems only.\\n"
    echo -e "${RED}#${RESET} Please run this script on a Debian-based system and try again."
    exit 1
  fi
    echo -e "${GREEN}#${RESET} This script is running on a Debian-based system.\\n"
}

get_update_confirmation(){
  read -p "This script will update Nomad and its dependencies on your machine. No data loss is expected, but you should always back up your data before proceeding. Are you sure you want to continue? (y/n): " choice
  case "$choice" in
    y|Y )
      echo -e "${GREEN}#${RESET} User chose to continue with the update."
      ;;
    n|N )
      echo -e "${RED}#${RESET} User chose not to continue with the update."
      exit 0
      ;;
    * )
      echo "Invalid Response"
      echo "User chose not to continue with the update."
      exit 0
      ;;
  esac
}

ensure_docker_installed_and_running() {
  if ! command -v docker &> /dev/null; then
    echo -e "${RED}#${RESET} Docker is not installed. This is unexpected, as Nomad requires Docker to run. Did you mean to use the install script instead of the update script?"
    exit 1
  fi

  if ! systemctl is-active --quiet docker; then
    echo -e "${RED}#${RESET} Docker is not running. Attempting to start Docker..."
    sudo systemctl start docker
    if ! systemctl is-active --quiet docker; then
      echo -e "${RED}#${RESET} Failed to start Docker. Please start Docker and try again."
      exit 1
    fi
  fi
}

ensure_docker_compose_file_exists() {
  if [ ! -f "${NOMAD_DIR}/compose.yml" ]; then
    echo -e "${RED}#${RESET} compose.yml file not found. Please ensure it exists at ${NOMAD_DIR}/compose.yml."
    exit 1
  fi
}

migrate_legacy_compose_file() {
  local compose_file="$1"

  sed -i \
    -e 's|^name: project-nomad$|name: nomad|' \
    -e 's|^COMPOSE_PROJECT_NAME="project-nomad"$|COMPOSE_PROJECT_NAME="nomad"|' \
    -e 's|ghcr.io/crosstalk-solutions/project-nomad|ghcr.io/hermes-os/nomad|g' \
    -e 's|/opt/project-nomad|/opt/nomad|g' \
    -e 's|^\([[:space:]]*-[[:space:]]*DOZZLE_ENABLE_SHELL\)[[:space:]]*=[[:space:]]*true$|\1=false|' \
    -e 's|^\([[:space:]]*-[[:space:]]*DOZZLE_ENABLE_SHELL\)[[:space:]]*=[[:space:]]*true\([[:space:]].*\)$|\1=false\2|' \
    "$compose_file"
}

migrate_legacy_installation() {
  if [[ -L "$LEGACY_NOMAD_DIR" ]] && [[ -e "$NOMAD_DIR" ]] &&
    [[ "$(readlink -f "$LEGACY_NOMAD_DIR")" == "$(readlink -f "$NOMAD_DIR")" ]]; then
    LEGACY_MIGRATION_PERFORMED='true'
    migrate_legacy_runtime_files
    return 0
  fi

  if [[ ! -e "$LEGACY_NOMAD_DIR" ]]; then
    return 0
  fi

  if [[ -e "$NOMAD_DIR" ]]; then
    echo -e "${RED}#${RESET} Both ${NOMAD_DIR} and the legacy installation directory exist. Move or remove one before continuing."
    exit 1
  fi

  if [[ -f "${LEGACY_NOMAD_DIR}/compose.yml" ]]; then
    docker compose -p "$LEGACY_COMPOSE_PROJECT_NAME" -f "${LEGACY_NOMAD_DIR}/compose.yml" down || true
  fi
  mv "$LEGACY_NOMAD_DIR" "$NOMAD_DIR"
  # Existing app containers retain their original bind configuration until they are recreated.
  ln -s "$NOMAD_DIR" "$LEGACY_NOMAD_DIR"
  migrate_legacy_runtime_files
  LEGACY_MIGRATION_PERFORMED='true'
}

migrate_legacy_runtime_files() {
  local file
  for file in "${NOMAD_DIR}/compose.yml" "${NOMAD_DIR}/sidecar-updater/update-watcher.sh"; do
    if [[ ! -f "$file" ]]; then
      continue
    fi
    migrate_legacy_compose_file "$file"
  done
}

migrate_legacy_container_networks() {
  if [[ "$LEGACY_MIGRATION_PERFORMED" != 'true' ]]; then
    return 0
  fi

  local container
  local container_networks
  local migration_failed='false'
  while read -r container; do
    case "$container" in
      nomad_admin|nomad_dozzle|nomad_mysql|nomad_redis|nomad_updater) continue ;;
    esac
    docker network connect nomad_default "$container" 2>/dev/null || true
    if ! container_networks=$(docker inspect --format '{{range $network, $_ := .NetworkSettings.Networks}}{{println $network}}{{end}}' "$container") ||
      ! grep -Fxq nomad_default <<< "$container_networks"; then
      echo "Failed to connect ${container} to nomad_default. It remains on the legacy network; resolve the Docker network error and rerun the updater." >&2
      migration_failed='true'
      continue
    fi
    if grep -Fxq project-nomad_default <<< "$container_networks" &&
      ! docker network disconnect project-nomad_default "$container" 2>/dev/null; then
      echo "Failed to disconnect ${container} from the legacy network. Resolve the Docker network error and rerun the updater." >&2
      migration_failed='true'
    fi
  done < <(docker ps -a --filter "name=^nomad_" --format "{{.Names}}")

  if [[ "$migration_failed" == 'true' ]]; then
    return 1
  fi

  if docker network inspect project-nomad_default &>/dev/null &&
    ! docker network rm project-nomad_default 2>/dev/null; then
    echo "Failed to remove the legacy network. Resolve its remaining Docker endpoints and rerun the updater." >&2
    return 1
  fi
}

force_recreate() {
  migrate_legacy_compose_file "${NOMAD_DIR}/compose.yml"

  echo -e "${YELLOW}#${RESET} Pulling the latest Docker images..."
  if ! docker compose -p "$COMPOSE_PROJECT_NAME" -f "${NOMAD_DIR}/compose.yml" pull; then
    echo -e "${RED}#${RESET} Failed to pull the latest Docker images. Please check your network connection and the Docker registry status, then try again."
    exit 1
  fi
  
  echo -e "${YELLOW}#${RESET} Forcing recreation of containers..."
  if ! docker compose -p "$COMPOSE_PROJECT_NAME" -f "${NOMAD_DIR}/compose.yml" up -d --force-recreate --build; then
    echo -e "${RED}#${RESET} Failed to recreate containers. Please check the Docker logs for more details."
    exit 1
  fi

  migrate_legacy_container_networks || return 1
}

get_local_ip() {
  local_ip_address=$(hostname -I | awk '{print $1}')
  if [[ -z "$local_ip_address" ]]; then
    echo -e "${RED}#${RESET} Unable to determine local IP address. Please check your network configuration."
    # Don't exit if we can't determine the local IP address, it's not critical for the installation
  fi
}

success_message() {
  echo -e "${GREEN}#${RESET} Nomad installation completed successfully!\\n"
  echo -e "${GREEN}#${RESET} Installation files are located at /opt/nomad\\n\n"
  echo -e "${GREEN}#${RESET} Nomad's Command Center should automatically start whenever your device reboots. However, if you need to start it manually, you can always do so by running: ${WHITE_R}${nomad_dir}/start_nomad.sh${RESET}\\n"
  echo -e "${GREEN}#${RESET} You can now access the management interface at http://localhost:8080 or http://${local_ip_address}:8080\\n"
  echo -e "${GREEN}#${RESET} Thank you for supporting Nomad!\\n"
}

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                           Main Script                                                                                           #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################

# Pre-flight checks
check_is_debian_based
check_is_bash
check_has_sudo

# Main update
get_update_confirmation
ensure_docker_installed_and_running
migrate_legacy_installation
ensure_docker_compose_file_exists
force_recreate || exit 1
get_local_ip
success_message
