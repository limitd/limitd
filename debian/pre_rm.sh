#!/bin/bash

# prerm script for limitd package

NAME="limitd"

service $NAME stop || true
rm -f /etc/logrotate.d/$NAME-logs
