#include "IbClient.h"

v8::Persistent<v8::Function> IbClient::constructor;

IbClient::IbClient(long contractLength, int32_t hourOffset) : m_pClient(new EClientSocket(this, NULL)), processMsgsDecoder_(m_pClient->EClient::serverVersion(), m_pClient->getWrapper(), m_pClient) {
// Singleton order object
 order_.auxPrice = 0.0;
 order_.hidden = false; // false for futures, true for stocks
 order_.tif = "GTC";
 order_.outsideRth = false;
 order_.percentOffset = 0; // bug workaround
 contracts = new Contract[contractLength];
 hourOffset_ = hourOffset;
 msgData = std::vector<char>(IN_BUF_SIZE);
 offset = 0;
 msgSize = INT_SIZE;
 isMsgSize = true;
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

bool IbClient::connect(const char* host, unsigned int port, int clientId) {
  m_pClient->asyncEConnect(true);
  return m_pClient->eConnect(host, port, clientId, /* extraAuth */ false);
}

void IbClient::connectAck() {
  m_pClient->startApi();
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
      int size = m_pClient->receive(m_buf, IN_BUF_SIZE);
      char* start = m_buf;
      while (size > 0) {
        char* fullEnd = start + msgSize;
        char* tempEnd = m_buf + size;
        if (isMsgSize) {
          if (fullEnd > tempEnd) {
            std::copy(start, tempEnd, s_buf + offset);
            int copySize = tempEnd - start;
            offset += copySize;
            msgSize -= copySize;
            break;
          } else {
            if (offset == 0) {
              msgSize = htonl(*((int*)start));
            } else {
              std::copy(start, fullEnd, s_buf + offset);
              msgSize = htonl(*((int*)s_buf));
            }
            offset = 0;
            if (msgSize == 0) { // should not go into this if clause
              msgSize = INT_SIZE;
              continue;
            } // TODO what if msgSize < 0
            isMsgSize = false;
            if (fullEnd == tempEnd) {
              msgData.resize(msgSize);
              break;
            } else {
              start = fullEnd;
              fullEnd = start + msgSize;
              if (fullEnd > tempEnd) {
                msgData.resize(msgSize);
              }
            }
          }
        }

        if (fullEnd > tempEnd) {
          std::copy(start, tempEnd, msgData.data() + offset);
          int copySize = tempEnd - start;
          offset += copySize;
          msgSize -= copySize;
          break;
        } else {
          const char* pBegin;
          const char* pEnd;
          if (offset == 0) {
            pBegin = start;
            pEnd = fullEnd;
          } else {
            std::copy(start, fullEnd, msgData.data() + offset);
            pBegin = msgData.data();
            pEnd = pBegin + msgData.size();
          }
          processMsgsDecoder_.parseAndProcessMsg(pBegin, pEnd);
          msgSize = INT_SIZE;
          offset = 0;
          isMsgSize = true;
          if (fullEnd == tempEnd) {
            break;
          } else {
            start = fullEnd;
          }
        }
      }
    }
    //if (m_pClient->fd() < 0) {
    //  return;
    //}
    //if (FD_ISSET(m_pClient->fd(), &writeSet)) { // socket is ready for writing
    //}
  }
}

void IbClient::placeOrder(OrderId orderId, TickerId tickerId, const std::string &action, long quantity, const std::string &orderType, double lmtPrice, const std::string &expiry) {
  Contract* contract = &(contracts[tickerId - 1]); // tickerId is 1 base
  contract->lastTradeDateOrContractMonth = expiry;
  order_.action = action;
  order_.totalQuantity = quantity;
  order_.orderType = orderType;
  order_.lmtPrice = lmtPrice;
  m_pClient->placeOrder(orderId, *contract, order_);
}

void IbClient::cancelOrder(OrderId orderId) {
  m_pClient->cancelOrder(orderId);
}

void IbClient::reqMktData(TickerId tickerId, const std::string &genericTick, bool snapShot) {
  TagValueListSPtr mktDataOptions;
  m_pClient->reqMktData(tickerId, contracts[tickerId - 1], genericTick, snapShot, mktDataOptions);
}

void IbClient::reqAutoOpenOrders(bool bAutoBind) {
  m_pClient->reqAutoOpenOrders(bAutoBind);
}

void IbClient::reqAllOpenOrders() {
  m_pClient->reqAllOpenOrders();
}

void IbClient::reqRealTimeBars(TickerId tickerId, const std::string &whatToShow, bool useRTH) {
  TagValueListSPtr realTimeBarsOptions;
  // only 5 sec is supported
  m_pClient->reqRealTimeBars(tickerId, contracts[tickerId - 1], 5, whatToShow, useRTH, realTimeBarsOptions);
}

/**
 * events
 */
void IbClient::orderStatus(OrderId orderId, const std::string &status, double filled, double remaining, double avgFillPrice, int permId, int parentId, double lastFillPrice, int clientId, const std::string& whyHeld) {
  const unsigned argc = 9;
  v8::Local<v8::Value> arg0 = v8::Integer::New(isolate_, orderId);
  v8::Local<v8::Value> arg1 = v8::String::NewFromUtf8(isolate_, status.c_str());
  v8::Local<v8::Value> arg2 = v8::Number::New(isolate_, filled);
  v8::Local<v8::Value> arg3 = v8::Number::New(isolate_, avgFillPrice);
  v8::Local<v8::Value> arg4 = v8::Int32::New(isolate_, permId);
  v8::Local<v8::Value> arg5 = v8::Int32::New(isolate_, parentId);
  v8::Local<v8::Value> arg6 = v8::Number::New(isolate_, lastFillPrice);
  v8::Local<v8::Value> arg7 = v8::Int32::New(isolate_, clientId);
  v8::Local<v8::Value> arg8 = v8::String::NewFromUtf8(isolate_, whyHeld.c_str());
  v8::Local<v8::Value> argv[argc] = {arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8};
  v8::Local<v8::Function>::New(isolate_, orderStatus_)->Call(isolate_->GetCurrentContext()->Global(), argc, argv);
}

void IbClient::nextValidId(OrderId orderId) {
  const unsigned argc = 1;
  v8::Local<v8::Value> arg0 = v8::Integer::New(isolate_, orderId);
  v8::Local<v8::Value> argv[argc] = {arg0};
  v8::Local<v8::Function>::New(isolate_, nextValidId_)->Call(isolate_->GetCurrentContext()->Global(), argc, argv);
}

void IbClient::error(const int id, const int errorCode, const std::string errorString) {
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
  const unsigned argc = 8;
  v8::Local<v8::Value> arg0 = v8::Integer::New(isolate_, orderId);
  v8::Local<v8::Value> arg1 = v8::String::NewFromUtf8(isolate_, contract.symbol.c_str());
  v8::Local<v8::Value> arg2 = v8::String::NewFromUtf8(isolate_, contract.lastTradeDateOrContractMonth.c_str());
  v8::Local<v8::Value> arg3 = v8::String::NewFromUtf8(isolate_, order.action.c_str());
  v8::Local<v8::Value> arg4 = v8::Integer::New(isolate_, order.totalQuantity);
  v8::Local<v8::Value> arg5 = v8::String::NewFromUtf8(isolate_, order.orderType.c_str());
  v8::Local<v8::Value> arg6 = v8::Number::New(isolate_, order.lmtPrice);
  v8::Local<v8::Value> arg7 = v8::String::NewFromUtf8(isolate_, ostate.status.c_str());
  v8::Local<v8::Value> argv[argc] = {arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7};
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
void IbClient::tickString(TickerId tickerId, TickType tickType, const std::string& value) {}
void IbClient::tickEFP(TickerId tickerId, TickType tickType, double basisPoints, const std::string& formattedBasisPoints, double totalDividends, int holdDays, const std::string& futureLastTradeDate, double dividendImpact, double dividendsToLastTradeDate) {}
void IbClient::updateAccountValue(const std::string& key, const std::string& val, const std::string& currency, const std::string& accountName) {}
void IbClient::updatePortfolio(const Contract& contract, double position, double marketPrice, double marketValue, double averageCost, double unrealizedPNL, double realizedPNL, const std::string& accountName){}
void IbClient::updateAccountTime(const std::string& timeStamp) {}
void IbClient::contractDetails(int reqId, const ContractDetails& contractDetails) {}
void IbClient::bondContractDetails(int reqId, const ContractDetails& contractDetails) {}
void IbClient::execDetails(int reqId, const Contract& contract, const Execution& execution) {}
void IbClient::updateMktDepth(TickerId id, int position, int operation, int side, double price, int size) {}
void IbClient::updateMktDepthL2(TickerId id, int position, std::string marketMaker, int operation, int side, double price, int size) {}
void IbClient::updateNewsBulletin(int msgId, int msgType, const std::string& newsMessage, const std::string& originExch) {}
void IbClient::managedAccounts(const std::string& accountsList) {}
void IbClient::receiveFA(faDataType pFaDataType, const std::string& cxml) {}
void IbClient::historicalData(TickerId reqId, const std::string& date, double open, double high, double low, double close, int volume, int barCount, double WAP, int hasGaps) {}
void IbClient::scannerParameters(const std::string &xml) {}
void IbClient::scannerData(int reqId, int rank, const ContractDetails &contractDetails, const std::string &distance, const std::string &benchmark, const std::string &projection, const std::string &legsStr) {}
void IbClient::scannerDataEnd(int reqId) {}
void IbClient::currentTime(long time) {}
void IbClient::fundamentalData(TickerId reqId, const std::string& data) {}
void IbClient::contractDetailsEnd(int reqId) {}
void IbClient::openOrderEnd() {}
void IbClient::accountDownloadEnd(const std::string& accountName) {}
void IbClient::execDetailsEnd(int reqId) {}
void IbClient::deltaNeutralValidation(int reqId, const UnderComp& underComp) {}
void IbClient::tickSnapshotEnd(int reqId) {}
void IbClient::marketDataType(TickerId reqId, int marketDataType) {}
void IbClient::commissionReport(const CommissionReport& commissionReport) {}
void IbClient::position(const std::string& account, const Contract& contract, double position, double avgCost) {}
void IbClient::positionEnd() {}
void IbClient::accountSummary(int reqId, const std::string& account, const std::string& tag, const std::string& value, const std::string& curency) {}
void IbClient::accountSummaryEnd(int reqId) {}
void IbClient::verifyMessageAPI(const std::string& apiData) {}
void IbClient::verifyCompleted(bool isSuccessful, const std::string& errorText) {}
void IbClient::displayGroupList(int reqId, const std::string& groups) {}
void IbClient::displayGroupUpdated(int reqId, const std::string& contractInfo) {}
void IbClient::winError(const std::string &str, int lastError) {}
void IbClient::verifyAndAuthMessageAPI(const std::string& apiData, const std::string& xyzChallange) {}
void IbClient::verifyAndAuthCompleted(bool isSuccessful, const std::string& errorText) {}
void IbClient::positionMulti(int reqId, const std::string& account,const std::string& modelCode, const Contract& contract, double pos, double avgCost) {}
void IbClient::positionMultiEnd(int reqId) {}
void IbClient::accountUpdateMulti(int reqId, const std::string& account, const std::string& modelCode, const std::string& key, const std::string& value, const std::string& currency) {}
void IbClient::accountUpdateMultiEnd(int reqId) {}
void IbClient::securityDefinitionOptionalParameter(int reqId, const std::string& exchange, int underlyingConId, const std::string& tradingClass, const std::string& multiplier, std::set<std::string> expirations, std::set<double> strikes) {}
void IbClient::securityDefinitionOptionalParameterEnd(int reqId) {}
void IbClient::softDollarTiers(int reqId, const std::vector<SoftDollarTier> &tiers) {}

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
      Contract* contract = &(obj->contracts[i]);
      v8::Local<v8::Object> contractObject = contractArray->Get(i)->ToObject(isolate);
      v8::String::Utf8Value symbol(contractObject->Get(v8::String::NewFromUtf8(isolate, "symbol")));
      v8::String::Utf8Value secType(contractObject->Get(v8::String::NewFromUtf8(isolate, "secType")));
      v8::String::Utf8Value exchange(contractObject->Get(v8::String::NewFromUtf8(isolate, "exchange")));
      v8::String::Utf8Value primaryExchange(contractObject->Get(v8::String::NewFromUtf8(isolate, "primaryExchange")));
      v8::String::Utf8Value currency(contractObject->Get(v8::String::NewFromUtf8(isolate, "currency")));
      v8::String::Utf8Value expiry(contractObject->Get(v8::String::NewFromUtf8(isolate, "expiry")));
      contract->symbol = std::string(*symbol);
      contract->secType = std::string(*secType);
      contract->exchange = std::string(*exchange);
      contract->primaryExchange = std::string(*primaryExchange);
      contract->currency = std::string(*currency);
      contract->lastTradeDateOrContractMonth = std::string(*expiry);
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
  obj->placeOrder(orderId, tickerId, std::string(*action), quantity, std::string(*orderType), lmtPrice, std::string(*expiry));
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
  obj->reqMktData(tickerId, std::string(*genericTick), snapShot);
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
  obj->reqRealTimeBars(tickerId, std::string(*whatToShow), useRTH);
}
