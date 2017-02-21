#include "IbClient.h"

#include "EPosixClientSocket.h"
#include "EPosixClientSocketPlatform.h"

v8::Persistent<v8::Function> IbClient::constructor;

IbClient::IbClient(long contractLength, int32_t hourOffset) : m_pClient(new EPosixClientSocket(this)) {
// Singleton order object
 order_.auxPrice = 0.0;
 order_.hidden = false; // false for futures, true for stocks
 order_.tif = "GTC";
 order_.outsideRth = false;
 order_.percentOffset = 0; // bug workaround
 contracts = new Contract[contractLength];
 hourOffset_ = hourOffset;
}

IbClient::~IbClient() {
  orderStatus_.Reset();
  nextValidId_.Reset();
  error_.Reset();
  tickPrice_.Reset();
  openOrder_.Reset();
  realtimeBar_.Reset();
  connectionClosed_.Reset();
  delete m_pClient;
  delete[] contracts;
}

bool IbClient::connect(const char *host, unsigned int port, int clientId) {
  return m_pClient->eConnect(host, port, clientId, /* extraAuth */ false);
}

void IbClient::disconnect() const {
  m_pClient->eDisconnect();
}

void IbClient::processMessages() {
  fd_set readSet, writeSet, errorSet;

  struct timeval tval;
  tval.tv_usec = 0; // timeout immediately (no blocking)
  tval.tv_sec = 0; // timeout immediately (no blocking)

  if (m_pClient->fd() >= 0) {
    FD_ZERO(&readSet);
    errorSet = writeSet = readSet;
    FD_SET(m_pClient->fd(), &readSet);
    FD_SET(m_pClient->fd(), &writeSet);
    FD_SET(m_pClient->fd(), &errorSet);
    int ret = select(m_pClient->fd() + 1, &readSet, &writeSet, &errorSet, &tval);
    if (ret == 0) { // timeout
      return;
    }
    if (ret < 0) { // error
      disconnect();
      return;
    }
    if (m_pClient->fd() < 0) {
      return;
    }
    if (FD_ISSET(m_pClient->fd(), &errorSet)) { // error on socket
      m_pClient->onError();
    }
    if (m_pClient->fd() < 0) {
      return;
    }
    if (FD_ISSET(m_pClient->fd(), &readSet)) { // socket is ready for reading
      m_pClient->onReceive();
    }
    if (m_pClient->fd() < 0) {
      return;
    }
    if (FD_ISSET(m_pClient->fd(), &writeSet)) { // socket is ready for writing
      m_pClient->onSend();
    }
  }
}

void IbClient::placeOrder(OrderId orderId, TickerId tickerId, const IBString &action, long quantity, const IBString &orderType, double lmtPrice, const IBString &expiry) {
  Contract* contract = &(contracts[tickerId - 1]); // tickerId is 1 base
  contract->expiry = expiry;
  order_.action = action;
  order_.totalQuantity = quantity;
  order_.orderType = orderType;
  order_.lmtPrice = lmtPrice;
  m_pClient->placeOrder(orderId, *contract, order_);
}

void IbClient::cancelOrder(OrderId orderId) {
  m_pClient->cancelOrder(orderId);
}

void IbClient::reqMktData(TickerId tickerId, const IBString &genericTick, bool snapShot) {
  TagValueListSPtr mktDataOptions;
  m_pClient->reqMktData(tickerId, contracts[tickerId - 1], genericTick, snapShot, mktDataOptions);
}

void IbClient::reqAutoOpenOrders(bool bAutoBind) {
  m_pClient->reqAutoOpenOrders(bAutoBind);
}

void IbClient::reqAllOpenOrders() {
  m_pClient->reqAllOpenOrders();
}

void IbClient::reqRealTimeBars(TickerId tickerId, const IBString &whatToShow, bool useRTH) {
  TagValueListSPtr realTimeBarsOptions;
  // only 5 sec is supported
  m_pClient->reqRealTimeBars(tickerId, contracts[tickerId - 1], 5, whatToShow, useRTH, realTimeBarsOptions);
}

/**
 * events
 */
void IbClient::orderStatus(OrderId orderId, const IBString &status, int filled, int remaining, double avgFillPrice, int permId, int parentId, double lastFillPrice, int clientId, const IBString& whyHeld) {
  const unsigned argc = 10;
  v8::Local<v8::Value> arg0 = v8::Integer::New(isolate_, orderId);
  v8::Local<v8::Value> arg1 = v8::String::NewFromUtf8(isolate_, status.c_str());
  v8::Local<v8::Value> arg2 = v8::Int32::New(isolate_, filled);
  v8::Local<v8::Value> arg3 = v8::Int32::New(isolate_, remaining);
  v8::Local<v8::Value> arg4 = v8::Number::New(isolate_, avgFillPrice);
  v8::Local<v8::Value> arg5 = v8::Int32::New(isolate_, permId);
  v8::Local<v8::Value> arg6 = v8::Int32::New(isolate_, parentId);
  v8::Local<v8::Value> arg7 = v8::Number::New(isolate_, lastFillPrice);
  v8::Local<v8::Value> arg8 = v8::Int32::New(isolate_, clientId);
  v8::Local<v8::Value> arg9 = v8::String::NewFromUtf8(isolate_, whyHeld.c_str());
  v8::Local<v8::Value> argv[argc] = {arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9};
  v8::Local<v8::Function>::New(isolate_, orderStatus_)->Call(isolate_->GetCurrentContext()->Global(), argc, argv);
}

void IbClient::nextValidId(OrderId orderId) {
  const unsigned argc = 1;
  v8::Local<v8::Value> arg0 = v8::Integer::New(isolate_, orderId);
  v8::Local<v8::Value> argv[argc] = {arg0};
  v8::Local<v8::Function>::New(isolate_, nextValidId_)->Call(isolate_->GetCurrentContext()->Global(), argc, argv);
}

void IbClient::error(const int id, const int errorCode, const IBString errorString) {
  const unsigned argc = 3;
  v8::Local<v8::Value> arg0 = v8::Int32::New(isolate_, id);
  v8::Local<v8::Value> arg1 = v8::Int32::New(isolate_, errorCode);
  v8::Local<v8::Value> arg2 = v8::String::NewFromUtf8(isolate_, errorString.c_str());
  v8::Local<v8::Value> argv[argc] = {arg0, arg1, arg2};
  v8::Local<v8::Function>::New(isolate_, error_)->Call(isolate_->GetCurrentContext()->Global(), argc, argv);
}

void IbClient::tickPrice(TickerId tickerId, TickType field, double price, int canAutoExecute) {
  const unsigned argc = 4;
  v8::Local<v8::Value> arg0 = v8::Integer::New(isolate_, tickerId);
  v8::Local<v8::Value> arg1 = v8::Uint32::New(isolate_, field);
  v8::Local<v8::Value> arg2 = v8::Number::New(isolate_, price);
  v8::Local<v8::Value> arg3 = v8::Int32::New(isolate_, canAutoExecute);
  v8::Local<v8::Value> argv[argc] = {arg0, arg1, arg2, arg3};
  v8::Local<v8::Function>::New(isolate_, tickPrice_)->Call(isolate_->GetCurrentContext()->Global(), argc, argv);
}

void IbClient::openOrder(OrderId orderId, const Contract& contract, const Order& order, const OrderState& ostate) {
  const unsigned argc = 9;
  v8::Local<v8::Value> arg0 = v8::Integer::New(isolate_, orderId);
  v8::Local<v8::Value> arg1 = v8::String::NewFromUtf8(isolate_, contract.symbol.c_str());
  v8::Local<v8::Value> arg2 = v8::String::NewFromUtf8(isolate_, contract.expiry.c_str());
  v8::Local<v8::Value> arg3 = v8::String::NewFromUtf8(isolate_, order.action.c_str());
  v8::Local<v8::Value> arg4 = v8::Integer::New(isolate_, order.totalQuantity);
  v8::Local<v8::Value> arg5 = v8::String::NewFromUtf8(isolate_, order.orderType.c_str());
  v8::Local<v8::Value> arg6 = v8::Number::New(isolate_, order.lmtPrice);
  v8::Local<v8::Value> arg7 = v8::String::NewFromUtf8(isolate_, ostate.status.c_str());
  v8::Local<v8::Value> arg8 = v8::Integer::New(isolate_, order.clientId);
  v8::Local<v8::Value> argv[argc] = {arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8};
  v8::Local<v8::Function>::New(isolate_, openOrder_)->Call(isolate_->GetCurrentContext()->Global(), argc, argv);
}

void IbClient::realtimeBar(TickerId reqId, long time, double open, double high, double low, double close, long volume, double wap, int count) {
  const unsigned argc = 11;
  long timeSec = time + 5; // realtimeBar time is the start of the bar (5 sec ago), fastforward 5 sec
  uint32_t second = timeSec % 60;
  uint32_t minute = (timeSec / 60) % 60;
  uint32_t hour = (timeSec / 3600 + hourOffset_) % 24;
  v8::Local<v8::Value> arg0 = v8::Integer::New(isolate_, reqId);
  v8::Local<v8::Value> arg1 = v8::Number::New(isolate_, open);
  v8::Local<v8::Value> arg2 = v8::Number::New(isolate_, high);
  v8::Local<v8::Value> arg3 = v8::Number::New(isolate_, low);
  v8::Local<v8::Value> arg4 = v8::Number::New(isolate_, close);
  v8::Local<v8::Value> arg5 = v8::Integer::New(isolate_, volume);
  v8::Local<v8::Value> arg6 = v8::Number::New(isolate_, wap);
  v8::Local<v8::Value> arg7 = v8::Int32::New(isolate_, count);
  v8::Local<v8::Value> arg8 = v8::Uint32::New(isolate_, second);
  v8::Local<v8::Value> arg9 = v8::Uint32::New(isolate_, minute);
  v8::Local<v8::Value> arg10 = v8::Uint32::New(isolate_, hour);
  v8::Local<v8::Value> argv[argc] = {arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10};
  v8::Local<v8::Function>::New(isolate_, realtimeBar_)->Call(isolate_->GetCurrentContext()->Global(), argc, argv);
}

void IbClient::connectionClosed() {
  v8::Local<v8::Function>::New(isolate_, connectionClosed_)->Call(isolate_->GetCurrentContext()->Global(), 0, NULL);
}

/**
 * placeholders
 */
void IbClient::tickSize(TickerId tickerId, TickType field, int size) {}
void IbClient::tickOptionComputation(TickerId tickerId, TickType tickType, double impliedVol, double delta, double optPrice, double pvDividend, double gamma, double vega, double theta, double undPrice) {}
void IbClient::tickGeneric(TickerId tickerId, TickType tickType, double value) {}
void IbClient::tickString(TickerId tickerId, TickType tickType, const IBString& value) {}
void IbClient::tickEFP(TickerId tickerId, TickType tickType, double basisPoints, const IBString& formattedBasisPoints, double totalDividends, int holdDays, const IBString& futureExpiry, double dividendImpact, double dividendsToExpiry) {}
void IbClient::updateAccountValue(const IBString& key, const IBString& val, const IBString& currency, const IBString& accountName) {}
void IbClient::updatePortfolio(const Contract& contract, int position, double marketPrice, double marketValue, double averageCost, double unrealizedPNL, double realizedPNL, const IBString& accountName){}
void IbClient::updateAccountTime(const IBString& timeStamp) {}
void IbClient::contractDetails(int reqId, const ContractDetails& contractDetails) {}
void IbClient::bondContractDetails(int reqId, const ContractDetails& contractDetails) {}
void IbClient::execDetails(int reqId, const Contract& contract, const Execution& execution) {}
void IbClient::updateMktDepth(TickerId id, int position, int operation, int side, double price, int size) {}
void IbClient::updateMktDepthL2(TickerId id, int position, IBString marketMaker, int operation, int side, double price, int size) {}
void IbClient::updateNewsBulletin(int msgId, int msgType, const IBString& newsMessage, const IBString& originExch) {}
void IbClient::managedAccounts(const IBString& accountsList) {}
void IbClient::receiveFA(faDataType pFaDataType, const IBString& cxml) {}
void IbClient::historicalData(TickerId reqId, const IBString& date, double open, double high, double low, double close, int volume, int barCount, double WAP, int hasGaps) {}
void IbClient::scannerParameters(const IBString &xml) {}
void IbClient::scannerData(int reqId, int rank, const ContractDetails &contractDetails, const IBString &distance, const IBString &benchmark, const IBString &projection, const IBString &legsStr) {}
void IbClient::scannerDataEnd(int reqId) {}
void IbClient::currentTime(long time) {}
void IbClient::fundamentalData(TickerId reqId, const IBString& data) {}
void IbClient::contractDetailsEnd(int reqId) {}
void IbClient::openOrderEnd() {}
void IbClient::accountDownloadEnd(const IBString& accountName) {}
void IbClient::execDetailsEnd(int reqId) {}
void IbClient::deltaNeutralValidation(int reqId, const UnderComp& underComp) {}
void IbClient::tickSnapshotEnd(int reqId) {}
void IbClient::marketDataType(TickerId reqId, int marketDataType) {}
void IbClient::commissionReport(const CommissionReport& commissionReport) {}
void IbClient::position(const IBString& account, const Contract& contract, int position, double avgCost) {}
void IbClient::positionEnd() {}
void IbClient::accountSummary(int reqId, const IBString& account, const IBString& tag, const IBString& value, const IBString& curency) {}
void IbClient::accountSummaryEnd(int reqId) {}
void IbClient::verifyMessageAPI(const IBString& apiData) {}
void IbClient::verifyCompleted(bool isSuccessful, const IBString& errorText) {}
void IbClient::displayGroupList(int reqId, const IBString& groups) {}
void IbClient::displayGroupUpdated(int reqId, const IBString& contractInfo) {}
void IbClient::winError(const IBString &str, int lastError) {}

/**
 * utilities
 */
void IbClient::updateContract(v8::Local<v8::Object> contractObject) {
  TickerId tickerId = contractObject->Get(v8::String::NewFromUtf8(isolate_, "cancelId"))->Uint32Value();
  Contract* contract = &(contracts[tickerId - 1]); // tickerId is 1 base
  v8::String::Utf8Value symbol(contractObject->Get(v8::String::NewFromUtf8(isolate_, "symbol")));
  v8::String::Utf8Value secType(contractObject->Get(v8::String::NewFromUtf8(isolate_, "secType")));
  v8::String::Utf8Value exchange(contractObject->Get(v8::String::NewFromUtf8(isolate_, "exchange")));
  v8::String::Utf8Value primaryExchange(contractObject->Get(v8::String::NewFromUtf8(isolate_, "primaryExchange")));
  v8::String::Utf8Value currency(contractObject->Get(v8::String::NewFromUtf8(isolate_, "currency")));
  v8::String::Utf8Value expiry(contractObject->Get(v8::String::NewFromUtf8(isolate_, "expiry")));
  contract->symbol = IBString(*symbol);
  contract->secType = IBString(*secType);
  contract->exchange = IBString(*exchange);
  contract->primaryExchange = IBString(*primaryExchange);
  contract->currency = IBString(*currency);
  contract->expiry = IBString(*expiry);
  if (contractObject->Has(v8::String::NewFromUtf8(isolate_, "right"))) {
    v8::String::Utf8Value right(contractObject->Get(v8::String::NewFromUtf8(isolate_, "right")));
    contract->right = IBString(*right);
  }
  if (contractObject->Has(v8::String::NewFromUtf8(isolate_, "strike"))) {
    double strike = contractObject->Get(v8::String::NewFromUtf8(isolate_, "strike"))->NumberValue();
    contract->strike = strike;
  }
}

/**
 * v8
 */
void IbClient::Init(v8::Local<v8::Object> exports) {
  v8::Isolate* isolate = exports->GetIsolate();

  // Prepare constructor template
  v8::Local<v8::FunctionTemplate> tpl = v8::FunctionTemplate::New(isolate, New);
  tpl->SetClassName(v8::String::NewFromUtf8(isolate, "IbClient"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  // Prototype
  NODE_SET_PROTOTYPE_METHOD(tpl, "updateContract", UpdateContract);
  NODE_SET_PROTOTYPE_METHOD(tpl, "processMessages", ProcessMessages);
  NODE_SET_PROTOTYPE_METHOD(tpl, "connect", Connect);
  NODE_SET_PROTOTYPE_METHOD(tpl, "disconnect", Disconnect);
  NODE_SET_PROTOTYPE_METHOD(tpl, "placeOrder", PlaceOrder);
  NODE_SET_PROTOTYPE_METHOD(tpl, "cancelOrder", CancelOrder);
  NODE_SET_PROTOTYPE_METHOD(tpl, "reqMktData", ReqMktData);
  NODE_SET_PROTOTYPE_METHOD(tpl, "reqAutoOpenOrders", ReqAutoOpenOrders);
  NODE_SET_PROTOTYPE_METHOD(tpl, "reqAllOpenOrders", ReqAllOpenOrders);
  NODE_SET_PROTOTYPE_METHOD(tpl, "reqRealTimeBars", ReqRealTimeBars);

  constructor.Reset(isolate, tpl->GetFunction());
  exports->Set(v8::String::NewFromUtf8(isolate, "IbClient"), tpl->GetFunction());
}

void IbClient::New(const v8::FunctionCallbackInfo<v8::Value>& args) {
  v8::Isolate* isolate = args.GetIsolate();

  if (args.IsConstructCall()) {
    // Invoked as constructor: `new MyObject(...)`
    v8::Local<v8::Array> contractArray = v8::Local<v8::Array>::Cast(args[0]);
    uint32_t contractLength = contractArray->Length();
    int32_t hourOffset = args[1]->Int32Value();
    IbClient* obj = new IbClient(contractLength, hourOffset);
    obj->isolate_ = isolate;
    obj->orderStatus_.Reset(isolate, v8::Local<v8::Function>::Cast(args[2]));
    obj->nextValidId_.Reset(isolate, v8::Local<v8::Function>::Cast(args[3]));
    obj->error_.Reset(isolate, v8::Local<v8::Function>::Cast(args[4]));
    obj->tickPrice_.Reset(isolate, v8::Local<v8::Function>::Cast(args[5]));
    obj->openOrder_.Reset(isolate, v8::Local<v8::Function>::Cast(args[6]));
    obj->realtimeBar_.Reset(isolate, v8::Local<v8::Function>::Cast(args[7]));
    obj->connectionClosed_.Reset(isolate, v8::Local<v8::Function>::Cast(args[8]));
    for (uint32_t i = 0; i < contractLength; i++) {
      v8::Local<v8::Object> contractObject = contractArray->Get(i)->ToObject(isolate);
      obj->updateContract(contractObject);
    }
    obj->Wrap(args.This());
    args.GetReturnValue().Set(args.This());
  } else {
    // Invoked as plain function `MyObject(...)`, turn into construct call.
    const int argc = 8;
    v8::Local<v8::Value> argv[argc] = {args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7]};
    v8::Local<v8::Context> context = isolate->GetCurrentContext();
    v8::Local<v8::Function> cons = v8::Local<v8::Function>::New(isolate, constructor);
    v8::Local<v8::Object> result = cons->NewInstance(context, argc, argv).ToLocalChecked();
    args.GetReturnValue().Set(result);
  }
}

void IbClient::UpdateContract(const v8::FunctionCallbackInfo<v8::Value>& args) {
  IbClient* obj = ObjectWrap::Unwrap<IbClient>(args.Holder());
  v8::Local<v8::Object> contractObject = args[0]->ToObject(obj->isolate_);
  obj->updateContract(contractObject);
}

void IbClient::ProcessMessages(const v8::FunctionCallbackInfo<v8::Value>& args) {
  IbClient* obj = ObjectWrap::Unwrap<IbClient>(args.Holder());
  obj->processMessages(); // 1
  obj->processMessages(); // 2
  obj->processMessages(); // 3
  obj->processMessages(); // 4
  obj->processMessages(); // 5
  obj->processMessages(); // 6
  obj->processMessages(); // 7
  obj->processMessages(); // 8
}

void IbClient::Connect(const v8::FunctionCallbackInfo<v8::Value>& args) {
  // http://stackoverflow.com/questions/10507323/shortest-way-one-liner-to-get-a-default-argument-out-of-a-v8-function
  v8::String::Utf8Value host(args[0]);
  uint32_t port = args[1]->Uint32Value();
  int32_t clientId = args[2]->Int32Value();
  IbClient* obj = ObjectWrap::Unwrap<IbClient>(args.Holder());
  bool connected = obj->connect(*host, port, clientId);
  args.GetReturnValue().Set(connected);
}

void IbClient::Disconnect(const v8::FunctionCallbackInfo<v8::Value>& args) {
  IbClient* obj = ObjectWrap::Unwrap<IbClient>(args.Holder());
  obj->disconnect();
}

void IbClient::PlaceOrder(const v8::FunctionCallbackInfo<v8::Value>& args) {
  OrderId orderId = args[0]->IntegerValue();
  TickerId tickerId = args[1]->IntegerValue();
  v8::String::Utf8Value action(args[2]);
  long quantity = args[3]->IntegerValue();
  v8::String::Utf8Value orderType(args[4]);
  double lmtPrice = args[5]->NumberValue();
  v8::String::Utf8Value expiry(args[6]);
  IbClient* obj = ObjectWrap::Unwrap<IbClient>(args.Holder());
  obj->placeOrder(orderId, tickerId, IBString(*action), quantity, IBString(*orderType), lmtPrice, IBString(*expiry));
}

void IbClient::CancelOrder(const v8::FunctionCallbackInfo<v8::Value>& args) {
  OrderId orderId = args[0]->IntegerValue();
  IbClient* obj = ObjectWrap::Unwrap<IbClient>(args.Holder());
  obj->cancelOrder(orderId);
}

void IbClient::ReqMktData(const v8::FunctionCallbackInfo<v8::Value>& args) {
  TickerId tickerId = args[0]->IntegerValue();
  v8::String::Utf8Value genericTick(args[1]);
  bool snapShot = args[2]->BooleanValue();
  IbClient* obj = ObjectWrap::Unwrap<IbClient>(args.Holder());
  obj->reqMktData(tickerId, IBString(*genericTick), snapShot);
}

void IbClient::ReqAutoOpenOrders(const v8::FunctionCallbackInfo<v8::Value>& args) {
  bool bAutoBind = args[0]->BooleanValue();
  IbClient* obj = ObjectWrap::Unwrap<IbClient>(args.Holder());
  obj->reqAutoOpenOrders(bAutoBind);
}

void IbClient::ReqAllOpenOrders(const v8::FunctionCallbackInfo<v8::Value>& args) {
  IbClient* obj = ObjectWrap::Unwrap<IbClient>(args.Holder());
  obj->reqAllOpenOrders();
}

void IbClient::ReqRealTimeBars(const v8::FunctionCallbackInfo<v8::Value>& args) {
  TickerId tickerId = args[0]->IntegerValue();
  v8::String::Utf8Value whatToShow(args[1]);
  bool useRTH = args[2]->BooleanValue();
  IbClient* obj = ObjectWrap::Unwrap<IbClient>(args.Holder());
  obj->reqRealTimeBars(tickerId, IBString(*whatToShow), useRTH);
}
