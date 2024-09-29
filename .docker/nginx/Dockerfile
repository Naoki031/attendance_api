FROM nginx:alpine as dependency-base

# Override default shell
SHELL ["/bin/ash", "-oeux", "pipefail", "-c"]

# Copy custom Nginx configuration file
COPY ./.docker/nginx/nginx.conf /etc/nginx/nginx.conf

# Install minimum required package
RUN apk update && \
    apk add --update --no-cache --virtual=.build-dependencies g++

#=========================================
# Multi stage build - local stage
#=========================================
FROM dependency-base AS local

# Place config template file into the image
COPY ./.docker/nginx/development.conf /etc/nginx/conf.d/default.conf

WORKDIR /home/client

CMD ["nginx", "-g", "daemon off;"]

EXPOSE 80