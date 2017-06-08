rm -rf IBJts
wget -c http://interactivebrokers.github.io/downloads/twsapi_macunix.972.18.zip
unzip twsapi_macunix.972.18.zip
rm -rf META-INF

sed -i.bak 's/assert(dynamic_cast/\/\/assert(dynamic_cast/' IBJts/source/CppClient/client/EClientSocket.cpp
sed -i.bak 's/min/std::min/' IBJts/source/CppClient/client/EReader.cpp
