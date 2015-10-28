#!/bin/bash

# preinst script for limitd package

NAME="limitd"
file_default="/etc/default/$NAME_defaults"
file_init="/etc/init/$NAME.conf"

# Create user and group if non-existant
if ! getent passwd $NAME > /dev/null
then
  adduser --quiet --group --system --no-create-home $NAME
fi

if ! getent group $NAME > /dev/null
then
 	addgroup --quiet --system $NAME
fi

# Copy actual config files for verification on the postint script
if [ -e $file_default ]
then
	cp $file_default $file_default.postinst
fi

if [ -e $file_init ]
then
	cp $file_init $file_init.postinst
fi
