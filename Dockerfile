# Guincho 24h Online — site estático servido por Nginx dentro do Easypanel (Hostinger VPS).
# O Easypanel (Traefik) cuida do domínio e do HTTPS; este contêiner atende na porta 80.
FROM nginx:1.27-alpine
RUN rm -f /etc/nginx/conf.d/default.conf && mkdir -p /etc/nginx/snippets
COPY nginx/site.conf /etc/nginx/conf.d/site.conf
COPY nginx/guincho24honline-301.conf /etc/nginx/snippets/guincho24honline-301.conf
COPY site/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
