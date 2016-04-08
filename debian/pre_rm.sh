#!/bin/bash

# prerm script for limitd package

NAME="limitd"

case "$1" in
  remove)
  echo "Removing $NAME"
  echo "Stopping service"
  service $NAME stop || true
  rm -f /etc/logrotate.d/$NAME-logs
  ;;
esac