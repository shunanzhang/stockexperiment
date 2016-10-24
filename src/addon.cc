#include <node.h>
#include "sma.h"
#include "tradeController.h"
#include "IbClient.h"

namespace demo {

using v8::Local;
using v8::Object;

void InitAll(Local<Object> exports) {
  Sma::Init(exports);
  TradeController::Init(exports);
  IbClient::Init(exports);
}

NODE_MODULE(addon, InitAll)

}  // namespace demo
