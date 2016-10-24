rm -rf IBJts
wget -c http://interactivebrokers.github.io/downloads/twsapi_macunix.971.01.jar
unzip twsapi_macunix.971.01.jar

# http://stackoverflow.com/questions/5694228/sed-in-place-flag-that-works-both-on-mac-bsd-and-linux
sed -i.bak 's/\/\/ LINUX/#include <unistd.h>/' IBJts/source/PosixClient/src/EPosixClientSocketPlatform.h
