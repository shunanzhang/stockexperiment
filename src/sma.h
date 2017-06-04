#ifndef SMA_H
#define SMA_H

#include <node.h>
#include <node_object_wrap.h>

namespace demo {

class Sma: public node::ObjectWrap {
 public:
  static void Init(v8::Local<v8::Object> exports);

  explicit Sma(uint32_t length = 0);
  ~Sma();
  void reset();
  void push(double value);
  double ave_;
  bool up_;
  bool down_;

 private:
  static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void Push(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void GetAve(v8::Local<v8::String> property, const v8::PropertyCallbackInfo<v8::Value>& info);
  static void GetUp(v8::Local<v8::String> property, const v8::PropertyCallbackInfo<v8::Value>& info);
  static void GetDown(v8::Local<v8::String> property, const v8::PropertyCallbackInfo<v8::Value>& info);
  static v8::Persistent<v8::Function> constructor;
  uint32_t length_;
  uint32_t maxI_;
  double* data_; // array
  double sum_;
  uint32_t i_;
};

}  // namespace demo

#endif
