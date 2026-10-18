#!/bin/sh
# Sobe o envio dos pop-ups (reinicia sozinho se cair) e o Nginx em primeiro plano.
( while true; do node /opt/api/lead.mjs; echo "[lead] parou; reiniciando em 2 s"; sleep 2; done ) &
exec nginx -g 'daemon off;'
