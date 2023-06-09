import { data } from "@ampt/data";
import { v4 as uuid } from "uuid";
import { Order, OrderEvent } from "../../../types/orders";

async function getOrderById(id: string) {
  const res = await data.get<Order>(`order:${id}`);
  if (!res) return new OrderNotFoundError();

  return res as Order;
}

async function getAllOrders() {
  const res = await data.get<Order>("order:*", { meta: true });

  return res.items.map((i) => i.value);
}

async function placeOrder(input: {
  productId: string;
  customerId: string;
}): Promise<Order> {
  const order: Order = {
    id: uuid(),
    productId: input.productId,
    customerId: input.customerId,
    status: "placed",

    log: [
      {
        type: "order placed",
        id: uuid(),
        productId: input.productId,
        customerId: input.customerId,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const placed = await data.set<Order>(`order:${order.id}`, order, {
    label1: `orders:${input.customerId}`,
  });

  return placed as Order;
}

async function prepareOrder(id: string) {
  const order = await getOrderById(id);

  if (order instanceof OrderNotFoundError) return order;

  if (order.status !== "placed") return new OrderAlreadyPreparedError();

  order.status = "prepared";
  order.log.push({
    type: "order prepared",
    id: uuid(),
    timestamp: new Date().toISOString(),
  });

  const prepared = await data.set<Order>(`order:${id}`, order);

  return prepared as Order;
}

async function pickUpOrder(id: string) {
  const order = await getOrderById(id);

  if (order instanceof OrderNotFoundError) return order;

  if (order.status !== "prepared") return new OrderCannotBePickedUp();

  order.status = "picked up";
  order.log.push({
    type: "order picked up",
    id: uuid(),
    timestamp: new Date().toISOString(),
  });

  const pickedUp = await data.set<Order>(`order:${id}`, order);

  return pickedUp as Order;
}

async function cancelOrder(id: string) {
  const order = await getOrderById(id);

  if (order instanceof OrderNotFoundError) return order;

  if (order.status !== "placed") return new OrderAlreadyPreparedError();

  order.status = "cancelled";
  order.log.push({
    type: "order cancelled",
    id: uuid(),
    timestamp: new Date().toISOString(),
  });

  const cancelled = await data.set<Order>(`order:${id}`, order);

  return cancelled as Order;
}

async function getOrdersByCustomerId(customerId: string) {
  const orderData = await data.getByLabel<Order>(
    "label1",
    `orders:${customerId}`
  );

  return (orderData as any).items.map(({ key, value }) => value) as Order[];
}

export class OrderNotFoundError extends Error {
  constructor() {
    super("Order not found");
  }
}

export class OrderAlreadyPreparedError extends Error {
  constructor() {
    super("Order already prepared");
  }
}

export class OrderCannotBePickedUp extends Error {
  constructor() {
    super("Order cannot be picked up");
  }
}

function onOrderUpdate(
  callback: (event: OrderEvent, order: Order) => Promise<void>
) {
  data.on("*:order:*", async ({ item }) => {
    const order = item.value as Order;
    const event = order.log[order.log.length - 1];
    console.debug("order event", { event, order });
    return callback(event, order);
  });
}

export const Orders = {
  getOrderById,
  getAllOrders,
  placeOrder,
  prepareOrder,
  pickUpOrder,
  cancelOrder,
  getOrdersByCustomerId,
  onOrderUpdate,
};
