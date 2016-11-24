FROM node:4.4.7

WORKDIR /app

ARG port=9231
ARG db=/data

# make sure config file is provided. it is mandatory since that is where the buckets are obtained
ARG config
RUN if [ -z "$config" ]; then echo "ERROR: config argument not set"; exit 1; else : ; fi

ENV PORT $port
ENV DB $db

# create db directory
RUN mkdir $db 

# limitd's default port
EXPOSE $port

# Prep for running with non-root
RUN useradd -ms /bin/bash limitd && \
    # make limitd user an admin of db directory
    chown -R limitd $db

# copy config file
RUN mkdir /app/_config
COPY $config /app/_config/limitd.conf

COPY package.json /app/
RUN npm install --production

COPY . /app/

RUN chown -R limitd /app
USER limitd

# Don't use npm start to ensure it runs at PID=1
CMD ./bin/limitd --db $DB --port $PORT --config-file /app/_config/limitd.conf