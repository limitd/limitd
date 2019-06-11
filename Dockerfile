FROM node:8.16

WORKDIR /app

EXPOSE 9231

ADD package.json package-lock.json /app/
RUN npm install

# Bundle app source
ADD . /app

# Don't use npm start to ensure it runs at PID=1
CMD ["./bin/limitd"]
