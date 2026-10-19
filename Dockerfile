# Guincho 24h Online — site estático servido por Nginx dentro do Easypanel (Hostinger VPS).
# O Easypanel (Traefik) cuida do domínio e do HTTPS; este contêiner atende na porta 80.
FROM nginx:1.27-alpine
# Node só para o envio dos pop-ups por e-mail (api/lead.mjs, porta interna 3000)
RUN apk add --no-cache nodejs && rm -f /etc/nginx/conf.d/default.conf && mkdir -p /etc/nginx/snippets
COPY nginx/site.conf /etc/nginx/conf.d/site.conf
COPY nginx/seguranca.conf /etc/nginx/snippets/seguranca.conf
COPY nginx/guincho24honline-301.conf /etc/nginx/snippets/guincho24honline-301.conf
COPY site/ /usr/share/nginx/html/
COPY api/ /opt/api/
COPY iniciar.sh /iniciar.sh
RUN chmod +x /iniciar.sh
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
CMD ["/iniciar.sh"]
