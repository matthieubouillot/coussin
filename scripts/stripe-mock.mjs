// Faux serveur Stripe pour les tests de charge locaux (jamais en production).
// Imite les deux appels du tunnel de commande : création de coupon et de session Checkout.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const port = Number(process.env.STRIPE_MOCK_PORT ?? 12111);
let sessions = 0;

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const params = new URLSearchParams(body);
    res.setHeader("content-type", "application/json");
    if (req.method === "POST" && req.url === "/v1/coupons") {
      res.end(
        JSON.stringify({
          id: `co_mock_${randomBytes(6).toString("hex")}`,
          object: "coupon",
          amount_off: Number(params.get("amount_off")),
        }),
      );
      return;
    }
    if (req.method === "POST" && req.url === "/v1/checkout/sessions") {
      sessions += 1;
      const id = `cs_test_mock${randomBytes(12).toString("hex")}`;
      res.end(
        JSON.stringify({
          id,
          object: "checkout.session",
          url: `http://localhost:${port}/pay/${id}`,
          status: "open",
        }),
      );
      return;
    }
    if (req.method === "GET" && req.url?.startsWith("/pay/")) {
      res.setHeader("content-type", "text/html");
      res.end("<h1>Faux Stripe Checkout</h1>");
      return;
    }
    if (req.url === "/stats") {
      res.end(JSON.stringify({ sessions }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: { message: `Non simulé : ${req.method} ${req.url}` } }));
  });
}).listen(port, () => console.log(`Faux Stripe sur http://localhost:${port}`));
