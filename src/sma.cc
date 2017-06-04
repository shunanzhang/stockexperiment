#include "sma.h"

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

Persistent<Function> Sma::constructor;

Sma::Sma(uint32_t length) : length_(length) {
  // maxI_ is the rounded up to the next highest power of 2 from length - 1
  // http://graphics.stanford.edu/~seander/bithacks.html#RoundUpPowerOf2
  maxI_ = length - 1;
  maxI_ |= maxI_ >> 1;
  maxI_ |= maxI_ >> 2;
  maxI_ |= maxI_ >> 4;
  maxI_ |= maxI_ >> 8;
  maxI_ |= maxI_ >> 16;

  data_ = new double[maxI_ + 1];
  reset();
}

Sma::~Sma() {
  delete[] data_;
}

void Sma::reset() {
  for (uint32_t j = 0; j <= maxI_; j++) {
    data_[j] = 0.0;
  }
  ave_ = 0.0;
  sum_ = 0.0;
  up_ = false;
  down_ = false;
  i_ = 0;
}

void Sma::push(double value) {
  uint32_t i_first = (i_ - length_) & maxI_;
  uint32_t i_last = i_ & maxI_;
  sum_ -= data_[i_first];
  data_[i_last] = value;
  sum_ += value;
  double aveOld = ave_;
  ave_ = sum_ / length_;
  if (++i_ >= length_) {
    up_ = (ave_ > aveOld);
    down_ = (ave_ < aveOld);
  }
}

void Sma::Init(Local<Object> exports) {
  Isolate* isolate = exports->GetIsolate();

  // Prepare constructor template
  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
  tpl->SetClassName(String::NewFromUtf8(isolate, "Sma"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  // Prototype
  NODE_SET_PROTOTYPE_METHOD(tpl, "push", Push);

  // Accessor
  tpl->InstanceTemplate()->SetAccessor(String::NewFromUtf8(isolate, "ave"), GetAve);
  tpl->InstanceTemplate()->SetAccessor(String::NewFromUtf8(isolate, "up"), GetUp);
  tpl->InstanceTemplate()->SetAccessor(String::NewFromUtf8(isolate, "down"), GetDown);

  constructor.Reset(isolate, tpl->GetFunction());
  exports->Set(String::NewFromUtf8(isolate, "Sma"), tpl->GetFunction());
}

void Sma::New(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  if (args.IsConstructCall()) {
    // Invoked as constructor: `new MyObject(...)`
    uint32_t length = args[0]->Uint32Value();
    if (length > 256) {
      isolate->ThrowException(String::NewFromUtf8(isolate, "unsupported length"));
      return;
    }
    Sma* obj = new Sma(length);
    obj->Wrap(args.This());
    args.GetReturnValue().Set(args.This());
  } else {
    // Invoked as plain function `MyObject(...)`, turn into construct call.
    const int argc = 1;
    Local<Value> argv[argc] = { args[0] };
    Local<Context> context = isolate->GetCurrentContext();
    Local<Function> cons = Local<Function>::New(isolate, constructor);
    Local<Object> result = cons->NewInstance(context, argc, argv).ToLocalChecked();
    args.GetReturnValue().Set(result);
  }
}

void Sma::Push(const FunctionCallbackInfo<Value>& args) {
  double value = args[0]->NumberValue();

  Sma* obj = ObjectWrap::Unwrap<Sma>(args.Holder());
  obj->push(value);
}

void Sma::GetAve(Local<String> property, const PropertyCallbackInfo<Value>& info) {
  Sma* obj = ObjectWrap::Unwrap<Sma>(info.Holder());
  info.GetReturnValue().Set(obj->ave_);
}

void Sma::GetUp(Local<String> property, const PropertyCallbackInfo<Value>& info) {
  Sma* obj = ObjectWrap::Unwrap<Sma>(info.Holder());
  info.GetReturnValue().Set(obj->up_);
}

void Sma::GetDown(Local<String> property, const PropertyCallbackInfo<Value>& info) {
  Sma* obj = ObjectWrap::Unwrap<Sma>(info.Holder());
  info.GetReturnValue().Set(obj->down_);
}

}  // namespace demo
