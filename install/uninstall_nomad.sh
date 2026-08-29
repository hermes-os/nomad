#!/bin/bash

# Nomad Uninstall Script

###################################################################################################################################################################################################

# Script                | Nomad Uninstall Script
# Version               | 1.0.0
# Author                | Crosstalk Solutions, LLC
# Website               | https://crosstalksolutions.com

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                  Constants & Variables                                                                                          #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################

NOMAD_DIR="${NOMAD_DIR:-/opt/nomad}"
LEGACY_NOMAD_DIR="${LEGACY_NOMAD_DIR:-/opt/project-nomad}"
COMPOSE_PROJECT_NAME="nomad"
COMPOSE_NETWORK_NAME="nomad_default"
COMPOSE_UPDATE_VOLUME_NAME="nomad_nomad-update-shared"
MANAGEMENT_COMPOSE_FILE="${NOMAD_DIR}/compose.yml"
COLLECT_DISK_INFO_PID="/var/run/nomad-collect-disk-info.pid"
DISK_INFO_FILE="/tmp/nomad-disk-info.json"

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                     Functions                                                                                                   #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################

select_installation_directory() {
  if [[ ! -e "$NOMAD_DIR" && -e "$LEGACY_NOMAD_DIR" ]]; then
    NOMAD_DIR="$LEGACY_NOMAD_DIR"
    COMPOSE_PROJECT_NAME="project-nomad"
    COMPOSE_NETWORK_NAME="project-nomad_default"
    COMPOSE_UPDATE_VOLUME_NAME="project-nomad_nomad-update-shared"
  fi
  MANAGEMENT_COMPOSE_FILE="${NOMAD_DIR}/compose.yml"
}

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

check_current_directory(){
  if [ "$(pwd)" == "${NOMAD_DIR}" ]; then
    echo "Please run this script from a directory other than ${NOMAD_DIR}."
    exit 1
  fi
}

ensure_management_compose_file_exists(){
  if [ ! -f "${MANAGEMENT_COMPOSE_FILE}" ]; then
    echo "Unable to find the management Docker Compose file at ${MANAGEMENT_COMPOSE_FILE}. There may be a problem with your Nomad installation."
    exit 1
  fi
}

get_uninstall_confirmation(){
  read -p "This script will remove ALL Nomad files and containers. THIS CANNOT BE UNDONE. Are you sure you want to continue? (y/n): " choice
  case "$choice" in
    y|Y )
      echo -e "User chose to continue with the uninstallation."
      ;;
    n|N )
      echo -e "User chose not to continue with the uninstallation."
      exit 0
      ;;
    * )
      echo "Invalid Response"
      echo "User chose not to continue with the uninstallation."
      exit 0
      ;;
  esac
}

ensure_docker_installed() {
    if ! command -v docker &> /dev/null; then
        echo "Unable to find Docker. There may be a problem with your Docker installation."
        exit 1
    fi
}

try_remove_disk_info_script() {
    echo "Checking for running collect-disk-info script..."
    if [ -f "$COLLECT_DISK_INFO_PID" ]; then
        echo "Stopping collect-disk-info script..."
        kill "$(cat "$COLLECT_DISK_INFO_PID")"
        rm -f "$COLLECT_DISK_INFO_PID"
        echo "collect-disk-info script stopped."
    fi
}

try_remove_disk_info_file() {
    if [ -f "$DISK_INFO_FILE" ]; then
        echo "Removing disk info file..."
        rm -f "$DISK_INFO_FILE"
        echo "Disk info file removed."
    fi
}

remove_legacy_storage_compatibility_link() {
  if [[ -L "$LEGACY_NOMAD_DIR" ]] &&
    [[ "$(readlink -f "$LEGACY_NOMAD_DIR")" == "$(readlink -f "$NOMAD_DIR")" ]]; then
    rm "$LEGACY_NOMAD_DIR"
  fi
}

storage_cleanup() {
  read -p "Do you want to delete the Nomad storage directory (${NOMAD_DIR})? This is best if you want to start a completely fresh install. This will PERMANENTLY DELETE all stored Nomad data and can't be undone! (y/N): " delete_dir_choice
  case "$delete_dir_choice" in
      y|Y )
          echo "Removing Nomad files..."
          if rm -rf "${NOMAD_DIR}"; then
              echo "Nomad files removed."
          else
              echo "Warning: Failed to fully remove ${NOMAD_DIR}. You may need to remove it manually."
          fi
          ;;
      * )
          echo "Skipping removal of ${NOMAD_DIR}."
          ;;
  esac
}

uninstall_nomad() {
    echo "Stopping and removing Nomad management containers..."
    docker compose -p "$COMPOSE_PROJECT_NAME" -f "${MANAGEMENT_COMPOSE_FILE}" down
    echo "Allowing some time for management containers to stop..."
    sleep 5


    # Stop and remove all containers where name starts with "nomad_"
    echo "Stopping and removing all Nomad app containers..."
    docker ps -a --filter "name=^nomad_" --format "{{.Names}}" | xargs -r docker rm -f
    echo "Allowing some time for app containers to stop..."
    sleep 5

    echo "Containers should be stopped now."

    # Remove the shared Docker network (may still exist if app containers were using it during compose down)
    echo "Removing ${COMPOSE_NETWORK_NAME} network if it exists..."
    docker network rm "$COMPOSE_NETWORK_NAME" 2>/dev/null && echo "Network removed." || echo "Network already removed or not found."

    # Remove the shared update volume
    echo "Removing ${COMPOSE_UPDATE_VOLUME_NAME} volume if it exists..."
    docker volume rm "$COMPOSE_UPDATE_VOLUME_NAME" 2>/dev/null && echo "Volume removed." || echo "Volume already removed or not found."

    # Try to stop the collect-disk-info script if it's running
    try_remove_disk_info_script

    # Try to remove the disk info file if it exists
    try_remove_disk_info_file

    remove_legacy_storage_compatibility_link

    # Prompt user for storage cleanup and handle it if so
    storage_cleanup

    echo "Nomad has been uninstalled. We hope to see you again soon!"
}

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                       Main                                                                                                      #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################
select_installation_directory
check_has_sudo
check_current_directory
ensure_management_compose_file_exists
ensure_docker_installed
get_uninstall_confirmation
uninstall_nomad
