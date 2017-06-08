rm -rf IBJts
wget -c http://interactivebrokers.github.io/downloads/twsapi_macunix.972.18.zip
unzip twsapi_macunix.972.18.zip
rm -rf META-INF

# http://stackoverflow.com/questions/5694228/sed-in-place-flag-that-works-both-on-mac-bsd-and-linux
sed -i.bak 's/assert(dynamic_cast/\/\/assert(dynamic_cast/' IBJts/source/CppClient/client/EClientSocket.cpp
sed -i.bak 's/min/std::min/' IBJts/source/CppClient/client/EReader.cpp
