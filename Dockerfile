FROM node:8.16

RUN apt-get update && apt-get install -y apt-transport-https && \
  curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
  echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
  apt-get update && apt-get install -y yarn

WORKDIR /app

EXPOSE 9231

ADD package.json yarn.lock /app/
RUN yarn

# Bundle app source
ADD . /app

# Don't use npm start to ensure it runs at PID=1
CMD ["./bin/limitd"]
