#include "tradeController.h"

namespace demo {

using v8::Context;
using v8::Function;
using v8::FunctionCallbackInfo;
using v8::PropertyCallbackInfo;
using v8::FunctionTemplate;
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::Persistent;
using v8::String;
using v8::Value;

const char TradeController::BUY[] = "BUY";
const char TradeController::SELL[] = "SELL";
const char TradeController::HOLD[] = "HOLD";
const double TradeController::OFFSET = 0.001;
const double TradeController::OFFSET_POS = 1.001; // 1.0 + OFFSET
const double TradeController::OFFSET_NEG = 0.999; // 1.0 - OFFSET

Persistent<Function> TradeController::constructor;

TradeController::TradeController() {
  sma_ = new Sma(30);
  reset();
}

TradeController::~TradeController() {
  delete sma_;
}

void TradeController::reset() {
  for (uint32_t j = 0; j < 8; j++) {
    upper_[j] = 0.0;
    lower_[j] = 0.0;
    ks_[j] = 0.0;
  }
  above_ = false;
  below_ = false;
  i_ = 0;
  d_ = 0.0;
  sma_->reset();
}

const char* TradeController::trade(double close, double high, double low, double open, bool forceHold) {
  return tradeLogic(close, high, low, forceHold, i_ < 127);
}

const char* TradeController::tradeLogic(double mid, double high, double low, bool forceHold, bool noSma) {
  const char* result = HOLD;
  if (forceHold) {
    reset();
    return result;
  }
  i_++;
  uint32_t i_0 = (i_ - 7) & 7;
  uint32_t i_1 = (i_ - 6) & 7;
  uint32_t i_2 = (i_ - 5) & 7;
  uint32_t i_3 = (i_ - 4) & 7;
  uint32_t i_4 = (i_ - 3) & 7;
  uint32_t i_5 = (i_ - 2) & 7;
  uint32_t i_6 = (i_ - 1) & 7;
  uint32_t i_7 = i_ & 7;
  upper_[i_5] = high;
  lower_[i_5] = low;
  sma_->push(mid);
  // 6-3-3 Stochastic Oscillator
  if (i_ > 5) {
    //double maxUpper = max(upper_[i_0], upper_[i_1], upper_[i_2], upper_[i_3], upper_[i_4], high);
    //double minLower = min(lower_[i_0], lower_[i_1], lower_[i_2], lower_[i_3], lower_[i_4], low);
    double maxUpper = high;
    double minLower = low;
    maxUpper = upper_[i_4] > maxUpper ? upper_[i_4] : maxUpper;
    maxUpper = upper_[i_3] > maxUpper ? upper_[i_3] : maxUpper;
    maxUpper = upper_[i_2] > maxUpper ? upper_[i_2] : maxUpper;
    maxUpper = upper_[i_1] > maxUpper ? upper_[i_1] : maxUpper;
    maxUpper = upper_[i_0] > maxUpper ? upper_[i_0] : maxUpper;
    minLower = lower_[i_4] < minLower ? lower_[i_4] : minLower;
    minLower = lower_[i_3] < minLower ? lower_[i_3] : minLower;
    minLower = lower_[i_2] < minLower ? lower_[i_2] : minLower;
    minLower = lower_[i_1] < minLower ? lower_[i_1] : minLower;
    minLower = lower_[i_0] < minLower ? lower_[i_0] : minLower;
    double k = (mid - minLower) / (maxUpper - minLower);
    k = k < 0.0 ? 0.0 : (k > 1.0 ? 1.0 : k);
    ks_[i_7] = k;
    d_ = d_ - ks_[i_2] - ks_[i_3] - ks_[i_4] + ks_[i_5] + ks_[i_6] + k;
    if (i_ > 9) {
      bool d_le_80 = d_ <= 7.2; // 7.2 = 80 / (100 / 3 / 3)
      bool d_ge_20 = d_ >= 1.8; // 1.8 = 20 / (100 / 3 / 3)
      if (above_ && d_le_80 && (noSma || sma_->down_)) {
        result = SELL;
      } else if (below_ && d_ge_20 && (noSma || sma_->up_)) {
        result = BUY;
      } else if (!below_ && !d_ge_20) {
        result = SELL;
      }
      above_ = !d_le_80;
      below_ = !d_ge_20;
    }
  }
  return result;
}

void TradeController::Init(Local<Object> exports) {
  Isolate* isolate = exports->GetIsolate();

  // Prepare constructor template
  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
  tpl->SetClassName(String::NewFromUtf8(isolate, "TradeController"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  // Prototype
  NODE_SET_PROTOTYPE_METHOD(tpl, "trade", Trade);
  NODE_SET_PROTOTYPE_METHOD(tpl, "tradeLogic", TradeLogic);

  // Accessor
  tpl->GetFunction()->Set(String::NewFromUtf8(isolate, "BUY"), String::NewFromUtf8(isolate, BUY));
  tpl->GetFunction()->Set(String::NewFromUtf8(isolate, "SELL"), String::NewFromUtf8(isolate, SELL));
  tpl->GetFunction()->Set(String::NewFromUtf8(isolate, "HOLD"), String::NewFromUtf8(isolate, HOLD));
  tpl->GetFunction()->Set(String::NewFromUtf8(isolate, "OFFSET"), Number::New(isolate, OFFSET));
  tpl->GetFunction()->Set(String::NewFromUtf8(isolate, "OFFSET_POS"), Number::New(isolate, OFFSET_POS));
  tpl->GetFunction()->Set(String::NewFromUtf8(isolate, "OFFSET_NEG"), Number::New(isolate, OFFSET_NEG));

  constructor.Reset(isolate, tpl->GetFunction());
  exports->Set(String::NewFromUtf8(isolate, "TradeController"), tpl->GetFunction());
}

void TradeController::New(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  if (args.IsConstructCall()) {
    // Invoked as constructor: `new MyObject(...)`
    TradeController* obj = new TradeController();
    obj->Wrap(args.This());
    args.GetReturnValue().Set(args.This());
  } else {
    // Invoked as plain function `MyObject(...)`, turn into construct call.
    const int argc = 0;
    Local<Context> context = isolate->GetCurrentContext();
    Local<Function> cons = Local<Function>::New(isolate, constructor);
    Local<Object> result = cons->NewInstance(context, argc, NULL).ToLocalChecked();
    args.GetReturnValue().Set(result);
  }
}

void TradeController::Trade(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  double close = args[0]->NumberValue();
  double high = args[1]->NumberValue();
  double low = args[2]->NumberValue();
  double open = args[3]->NumberValue();
  bool forceHold = args[4]->BooleanValue();

  TradeController* obj = ObjectWrap::Unwrap<TradeController>(args.Holder());
  const char* result = obj->trade(close, high, low, open, forceHold);
  args.GetReturnValue().Set(String::NewFromUtf8(isolate, result));
}

void TradeController::TradeLogic(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  double close = args[0]->NumberValue();
  double high = args[1]->NumberValue();
  double low = args[2]->NumberValue();
  bool forceHold = args[3]->BooleanValue();
  bool noSma = args[4]->BooleanValue();

  TradeController* obj = ObjectWrap::Unwrap<TradeController>(args.Holder());
  const char* result = obj->tradeLogic(close, high, low, forceHold, noSma);
  args.GetReturnValue().Set(String::NewFromUtf8(isolate, result));
}

}  // namespace demo
