FROM nginx:1.29.1

SHELL ["/bin/bash", "-ec"]

COPY ./nginx.conf /etc/nginx/nginx.conf.template

CMD /bin/sh -c "rm -rf /etc/nginx/conf.d/default.conf; envsubst '\$DOMAIN:\$MAINLAND_HOST' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/spine-segmentation.conf && nginx -g 'daemon off;' || cat /etc/nginx/nginx.conf"