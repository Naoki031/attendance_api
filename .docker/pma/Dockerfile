#=========================================
# Common stage
#=========================================
FROM phpmyadmin/phpmyadmin:5.1.1 AS builder

# alias settings
RUN echo -e "\n\
    alias ll='ls -la --color'\n\
    " >> ~/.bashrc

# apacheバージョン、portなどの非表示
RUN sed -i -e "s|ServerTokens OS|ServerTokens Prod|" /etc/apache2/conf-available/security.conf
RUN sed -i -e "s|ServerSignature On|ServerSignature Off|" /etc/apache2/conf-available/security.conf

CMD ["apache2-foreground"]

#=========================================
# Multi stage build - testing stage
#=========================================
FROM builder AS staging

COPY ./.docker/pma/apache2/ports.conf /etc/apache2/ports.conf

# digest認証用のファイル
COPY ./.docker/pma/apache2/digest.conf /etc/apache2/sites-available/digest.conf
COPY ./.docker/digest/.digestpass /etc/apache2/.digestpass

# confのシンボリックリンクの作成とauth関連のモジュール設定
RUN a2ensite digest && \
    a2enmod auth_digest

# 80番の表記を書き換え
RUN sed -i -e "s|VirtualHost \*:80|VirtualHost \*:10080|" /etc/apache2/sites-available/000-default.conf

# 80の代わりに10080ポートを開く
EXPOSE 10080
