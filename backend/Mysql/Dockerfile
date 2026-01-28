FROM mysql:9.4.0

COPY . /docker-entrypoint-initdb.d/
RUN sed -i 's/\r$//' /docker-entrypoint-initdb.d/init.sh