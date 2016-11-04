#ifndef IBCLIENT_H
#define IBCLIENT_H

#include "EWrapper.h"
#include "Contract.h"
#include "Order.h"
#include "OrderState.h"

#include <node.h>
#include <node_object_wrap.h>

class EPosixClientSocket;

class IbClient : public EWrapper, public node::ObjectWrap {
public:
  explicit IbClient(long contractLength, int32_t hourOffset);
  ~IbClient();

  void processMessages();
  bool connect(const char * host, unsigned int port, int clientId = 0);
  void disconnect() const;
  void placeOrder(OrderId orderId, TickerId tickerId, const IBString &action, long quantity, const IBString &orderType, double lmtPrice, const IBString &expiry);
  void cancelOrder(OrderId orderId);

  void reqMktData(TickerId tickerId, const IBString &genericTicks, bool snapshot);
  void reqAutoOpenOrders(bool bAutoBind);
  void reqAllOpenOrders();
  void reqRealTimeBars(TickerId tickerId, const IBString &whatToShow, bool useRTH);

  // events
  void tickPrice(TickerId tickerId, TickType field, double price, int canAutoExecute);
  void orderStatus(OrderId orderId, const IBString &status, int filled, int remaining, double avgFillPrice, int permId, int parentId, double lastFillPrice, int clientId, const IBString& whyHeld);
  void openOrder(OrderId orderId, const Contract& contract, const Order& order, const OrderState& ostate);
  void nextValidId(OrderId orderId);
  void error(const int id, const int errorCode, const IBString errorString);
  void realtimeBar(TickerId reqId, long time, double open, double high, double low, double close, long volume, double wap, int count);
  void connectionClosed();

  // placeholders
  void tickSize(TickerId tickerId, TickType field, int size);
  void tickOptionComputation(TickerId tickerId, TickType tickType, double impliedVol, double delta, double optPrice, double pvDividend, double gamma, double vega, double theta, double undPrice);
  void tickGeneric(TickerId tickerId, TickType tickType, double value);
  void tickString(TickerId tickerId, TickType tickType, const IBString& value);
  void tickEFP(TickerId tickerId, TickType tickType, double basisPoints, const IBString& formattedBasisPoints, double totalDividends, int holdDays, const IBString& futureExpiry, double dividendImpact, double dividendsToExpiry);
  void updateAccountValue(const IBString& key, const IBString& val, const IBString& currency, const IBString& accountName);
  void updatePortfolio(const Contract& contract, int position, double marketPrice, double marketValue, double averageCost, double unrealizedPNL, double realizedPNL, const IBString& accountName);
  void updateAccountTime(const IBString& timeStamp);
  void contractDetails(int reqId, const ContractDetails& contractDetails);
  void bondContractDetails(int reqId, const ContractDetails& contractDetails);
  void execDetails(int reqId, const Contract& contract, const Execution& execution);
  void updateMktDepth(TickerId id, int position, int operation, int side, double price, int size);
  void updateMktDepthL2(TickerId id, int position, IBString marketMaker, int operation, int side, double price, int size);
  void updateNewsBulletin(int msgId, int msgType, const IBString& newsMessage, const IBString& originExch);
  void managedAccounts(const IBString& accountsList);
  void receiveFA(faDataType pFaDataType, const IBString& cxml);
  void historicalData(TickerId reqId, const IBString& date, double open, double high, double low, double close, int volume, int barCount, double WAP, int hasGaps);
  void scannerParameters(const IBString &xml);
  void scannerData(int reqId, int rank, const ContractDetails &contractDetails, const IBString &distance, const IBString &benchmark, const IBString &projection, const IBString &legsStr);
  void scannerDataEnd(int reqId);
  void currentTime(long time);
  void fundamentalData(TickerId reqId, const IBString& data);
  void contractDetailsEnd(int reqId);
  void openOrderEnd();
  void accountDownloadEnd(const IBString& accountName);
  void execDetailsEnd(int reqId);
  void deltaNeutralValidation(int reqId, const UnderComp& underComp);
  void tickSnapshotEnd(int reqId);
  void marketDataType(TickerId reqId, int marketDataType);
  void commissionReport(const CommissionReport& commissionReport);
  void position(const IBString& account, const Contract& contract, int position, double avgCost);
  void positionEnd();
  void accountSummary(int reqId, const IBString& account, const IBString& tag, const IBString& value, const IBString& curency);
  void accountSummaryEnd(int reqId);
  void verifyMessageAPI(const IBString& apiData);
  void verifyCompleted(bool isSuccessful, const IBString& errorText);
  void displayGroupList(int reqId, const IBString& groups);
  void displayGroupUpdated(int reqId, const IBString& contractInfo);
  void winError(const IBString &str, int lastError);

  // v8
  static void Init(v8::Local<v8::Object> exports);

private:
  EPosixClientSocket* m_pClient;
  Order order_; // Singleton order object
  Contract* contracts; // array

  // v8
  v8::Persistent<v8::Function> orderStatus_;
  v8::Persistent<v8::Function> nextValidId_;
  v8::Persistent<v8::Function> error_;
  v8::Persistent<v8::Function> tickPrice_;
  v8::Persistent<v8::Function> openOrder_;
  v8::Persistent<v8::Function> realtimeBar_;
  v8::Persistent<v8::Function> connectionClosed_;
  v8::Isolate* isolate_;
  int32_t hourOffset_;
  static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void ProcessMessages(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void Connect(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void Disconnect(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void PlaceOrder(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void CancelOrder(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void ReqMktData(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void ReqAutoOpenOrders(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void ReqAllOpenOrders(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void ReqRealTimeBars(const v8::FunctionCallbackInfo<v8::Value>& args);
  static v8::Persistent<v8::Function> constructor;
};

#endif
