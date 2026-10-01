import type { ReactNode } from "react";
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "react-email";

export type EmailShop = {
  shopName: string;
  sellerName: string;
  address: string;
  siret: string;
  email: string;
  siteUrl: string;
};

const font = "Helvetica, Arial, sans-serif";

export function EmailLayout({
  preview,
  shop,
  children,
}: {
  preview: string;
  shop: EmailShop;
  children: ReactNode;
}) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#f7f3ec",
          fontFamily: font,
          color: "#2b2420",
          margin: 0,
          padding: "24px 0",
        }}
      >
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: 24, maxWidth: 560 }}>
          <Text style={{ fontSize: 20, color: "#6b4a35", fontWeight: 700, margin: "0 0 16px" }}>
            {shop.shopName}
          </Text>
          {children}
          <Hr style={{ borderColor: "#e5ddd0", margin: "24px 0 12px" }} />
          <Section>
            <Text style={{ fontSize: 12, color: "#6b6560", lineHeight: "18px", margin: 0 }}>
              {shop.sellerName} — EI — {shop.address} — SIRET {shop.siret}
              <br />
              Contact : {shop.email} — {shop.siteUrl}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const textStyle = { fontSize: 15, lineHeight: "22px", margin: "0 0 12px" } as const;
export const smallStyle = { fontSize: 13, lineHeight: "19px", margin: "0 0 8px", color: "#4a423c" } as const;
export const linkStyle = { color: "#5f7360", textDecoration: "underline" } as const;
