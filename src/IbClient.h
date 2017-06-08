#ifndef IBCLIENT_H
#define IBCLIENT_H

#include "StdAfx.h"
#include "EClientSocket.h"
#include "EWrapper.h"
#include "EDecoder.h"
#include "Contract.h"
#include "Order.h"
#include "OrderState.h"
#include "EPosixClientSocketPlatform.h"

#include <node.h>
#include <node_object_wrap.h>

#define INT_SiZE 4
#define IN_BUF_SIZE 8192

class EPosixClientSocket;

class IbClient : public EWrapper, public node::ObjectWrap {
public:
  explicit IbClient(long contractLength, int32_t hourOffset);
  ~IbClient();

  void processMessages();
  bool connect(const char* host, unsigned int port, int clientId = 0);
  void disconnect() const;
  void placeOrder(OrderId orderId, TickerId tickerId, const std::string &action, long quantity, const std::string &orderType, double lmtPrice, const std::string &expiry);
  void cancelOrder(OrderId orderId);

  void reqMktData(TickerId tickerId, const std::string &genericTicks, bool snapshot);
  void reqAutoOpenOrders(bool bAutoBind);
  void reqAllOpenOrders();
  void reqRealTimeBars(TickerId tickerId, const std::string &whatToShow, bool useRTH);

  // events
  void tickPrice(TickerId tickerId, TickType field, double price, int canAutoExecute);
  void orderStatus(OrderId orderId, const std::string &status, double filled, double remaining, double avgFillPrice, int permId, int parentId, double lastFillPrice, int clientId, const std::string& whyHeld);
  void openOrder(OrderId orderId, const Contract& contract, const Order& order, const OrderState& ostate);
  void nextValidId(OrderId orderId);
  void error(const int id, const int errorCode, const std::string errorString);
  void realtimeBar(TickerId reqId, long time, double open, double high, double low, double close, long volume, double wap, int count);
  void connectionClosed();

  // placeholders
  void tickSize(TickerId tickerId, TickType field, int size);
  void tickOptionComputation(TickerId tickerId, TickType tickType, double impliedVol, double delta, double optPrice, double pvDividend, double gamma, double vega, double theta, double undPrice);
  void tickGeneric(TickerId tickerId, TickType tickType, double value);
  void tickString(TickerId tickerId, TickType tickType, const std::string& value);
  void tickEFP(TickerId tickerId, TickType tickType, double basisPoints, const std::string& formattedBasisPoints, double totalDividends, int holdDays, const std::string& futureLastTradeDate, double dividendImpact, double dividendsToLastTradeDate);
  void updateAccountValue(const std::string& key, const std::string& val, const std::string& currency, const std::string& accountName);
  void updatePortfolio(const Contract& contract, double position, double marketPrice, double marketValue, double averageCost, double unrealizedPNL, double realizedPNL, const std::string& accountName);
  void updateAccountTime(const std::string& timeStamp);
  void contractDetails(int reqId, const ContractDetails& contractDetails);
  void bondContractDetails(int reqId, const ContractDetails& contractDetails);
  void execDetails(int reqId, const Contract& contract, const Execution& execution);
  void updateMktDepth(TickerId id, int position, int operation, int side, double price, int size);
  void updateMktDepthL2(TickerId id, int position, std::string marketMaker, int operation, int side, double price, int size);
  void updateNewsBulletin(int msgId, int msgType, const std::string& newsMessage, const std::string& originExch);
  void managedAccounts(const std::string& accountsList);
  void receiveFA(faDataType pFaDataType, const std::string& cxml);
  void historicalData(TickerId reqId, const std::string& date, double open, double high, double low, double close, int volume, int barCount, double WAP, int hasGaps);
  void scannerParameters(const std::string &xml);
  void scannerData(int reqId, int rank, const ContractDetails &contractDetails, const std::string &distance, const std::string &benchmark, const std::string &projection, const std::string &legsStr);
  void scannerDataEnd(int reqId);
  void currentTime(long time);
  void fundamentalData(TickerId reqId, const std::string& data);
  void contractDetailsEnd(int reqId);
  void openOrderEnd();
  void accountDownloadEnd(const std::string& accountName);
  void execDetailsEnd(int reqId);
  void deltaNeutralValidation(int reqId, const UnderComp& underComp);
  void tickSnapshotEnd(int reqId);
  void marketDataType(TickerId reqId, int marketDataType);
  void commissionReport(const CommissionReport& commissionReport);
  void position(const std::string& account, const Contract& contract, double position, double avgCost);
  void positionEnd();
  void accountSummary(int reqId, const std::string& account, const std::string& tag, const std::string& value, const std::string& curency);
  void accountSummaryEnd(int reqId);
  void verifyMessageAPI(const std::string& apiData);
  void verifyCompleted(bool isSuccessful, const std::string& errorText);
  void displayGroupList(int reqId, const std::string& groups);
  void displayGroupUpdated(int reqId, const std::string& contractInfo);
  void winError(const std::string &str, int lastError);
  void verifyAndAuthMessageAPI(const std::string& apiData, const std::string& xyzChallange);
  void verifyAndAuthCompleted(bool isSuccessful, const std::string& errorText);
  void connectAck();
  void positionMulti(int reqId, const std::string& account,const std::string& modelCode, const Contract& contract, double pos, double avgCost);
  void positionMultiEnd(int reqId);
  void accountUpdateMulti(int reqId, const std::string& account, const std::string& modelCode, const std::string& key, const std::string& value, const std::string& currency);
  void accountUpdateMultiEnd(int reqId);
  void securityDefinitionOptionalParameter(int reqId, const std::string& exchange, int underlyingConId, const std::string& tradingClass, const std::string& multiplier, std::set<std::string> expirations, std::set<double> strikes);
  void securityDefinitionOptionalParameterEnd(int reqId);
  void softDollarTiers(int reqId, const std::vector<SoftDollarTier> &tiers);

  // v8
  static void Init(v8::Local<v8::Object> exports);

private:
  EClientSocket* m_pClient;
  char m_buf[IN_BUF_SIZE];
  char s_buf[INT_SiZE];
  int s_buf_start = 0;
  std::vector<char> msgData;
  int msgBufStart = 0;
  int msgSize = INT_SiZE;
  EDecoder processMsgsDecoder_;
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
