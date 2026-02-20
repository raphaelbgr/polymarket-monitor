import { create } from "zustand";
import { ActivityLogEntry, OrderStatus, SystemStatus } from "../types";

interface SystemState {
  status: SystemStatus;
  activityLog: ActivityLogEntry[];
  orderStatuses: OrderStatus[];
  setWsConnected: (connected: boolean) => void;
  setWsLastMessage: (timestamp: number) => void;
  setPollLastSuccess: (timestamp: number) => void;
  setCopyTradeEngine: (
    status: SystemStatus["copyTradeEngine"],
    message: string
  ) => void;
  setUserBalance: (balance: number) => void;
  addLogEntry: (entry: Omit<ActivityLogEntry, "id">) => void;
  addOrderStatus: (status: OrderStatus) => void;
  incrementOrders: (type: "filled" | "failed" | "skipped") => void;
}

let logCounter = 0;

export const useSystemStore = create<SystemState>((set, get) => ({
  status: {
    wsConnected: false,
    wsLastMessage: 0,
    pollLastSuccess: 0,
    copyTradeEngine: "OFF",
    copyTradeMessage: "No wallets have copy-trade enabled",
    userBalance: 0,
    ordersTotal: 0,
    ordersFilled: 0,
    ordersFailed: 0,
    ordersSkipped: 0,
  },
  activityLog: [],
  orderStatuses: [],

  setWsConnected: (connected) =>
    set((s) => ({ status: { ...s.status, wsConnected: connected } })),

  setWsLastMessage: (timestamp) =>
    set((s) => ({ status: { ...s.status, wsLastMessage: timestamp } })),

  setPollLastSuccess: (timestamp) =>
    set((s) => ({ status: { ...s.status, pollLastSuccess: timestamp } })),

  setCopyTradeEngine: (engine, message) =>
    set((s) => ({
      status: {
        ...s.status,
        copyTradeEngine: engine,
        copyTradeMessage: message,
      },
    })),

  setUserBalance: (balance) =>
    set((s) => ({ status: { ...s.status, userBalance: balance } })),

  addLogEntry: (entry) => {
    const id = `log-${++logCounter}-${Date.now()}`;
    set((s) => ({
      activityLog: [{ ...entry, id }, ...s.activityLog].slice(0, 200),
    }));
  },

  addOrderStatus: (status) =>
    set((s) => ({
      orderStatuses: [status, ...s.orderStatuses].slice(0, 100),
      status: { ...s.status, ordersTotal: s.status.ordersTotal + 1 },
    })),

  incrementOrders: (type) =>
    set((s) => ({
      status: {
        ...s.status,
        ...(type === "filled" && {
          ordersFilled: s.status.ordersFilled + 1,
        }),
        ...(type === "failed" && {
          ordersFailed: s.status.ordersFailed + 1,
        }),
        ...(type === "skipped" && {
          ordersSkipped: s.status.ordersSkipped + 1,
        }),
      },
    })),
}));
