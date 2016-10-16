#ifndef TRADECONTROLLER_H
#define TRADECONTROLLER_H

#include <node.h>
#include <node_object_wrap.h>
#include "sma.h"

namespace demo {

class TradeController: public node::ObjectWrap {
 public:
  static void Init(v8::Local<v8::Object> exports);

  explicit TradeController();
  ~TradeController();
  void reset();
  const char* trade(double close, double high, double low, double open, bool forceHold);
  const char* tradeLogic(double mid, double high, double low, double open, bool forceHold, bool noSma);
  const static char BUY[];
  const static char SELL[];
  const static char HOLD[];
  const static double OFFSET;
  const static double OFFSET_POS;
  const static double OFFSET_NEG;

 private:
  static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void Trade(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void TradeLogic(const v8::FunctionCallbackInfo<v8::Value>& args);
  static v8::Persistent<v8::Function> constructor;
  double upper_[8]; // array
  double lower_[8]; // array
  double ks_[8]; // array
  bool above_;
  bool below_;
  uint32_t i_;
  double d_;
  Sma* sma_;
};

}  // namespace demo

#endif
