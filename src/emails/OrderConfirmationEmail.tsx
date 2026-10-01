import { Column, Link, Row, Section, Text } from "react-email";
import { formatEuros } from "@/lib/money";
import { EmailLayout, linkStyle, smallStyle, textStyle, type EmailShop } from "./EmailLayout";

export type OrderConfirmationProps = {
  shop: EmailShop;
  orderNumber: string;
  customerName: string;
  lines: { label: string; quantity: number; totalCents: number }[];
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  vatExempt: boolean;
  shippingAddress: string[];
  deliveryEstimate: string;
  cgvVersion: string;
};

/**
 * Confirmation de commande sur support durable (art. L221-13 C. conso.) : éléments essentiels du
 * contrat, prix, délai, droit de rétractation, garanties. La facture PDF est jointe.
 */
export function OrderConfirmationEmail(p: OrderConfirmationProps) {
  return (
    <EmailLayout preview={`Commande ${p.orderNumber} confirmée`} shop={p.shop}>
      <Text style={textStyle}>Bonjour {p.customerName},</Text>
      <Text style={textStyle}>
        Merci pour votre commande <strong>{p.orderNumber}</strong> : votre paiement est confirmé. Vous
        recevrez un email avec le numéro de suivi dès l&apos;expédition.
      </Text>

      <Section style={{ backgroundColor: "#f7f3ec", borderRadius: 8, padding: 12, margin: "8px 0 16px" }}>
        {p.lines.map((l) => (
          <Row key={l.label}>
            <Column style={{ fontSize: 14 }}>
              {l.quantity} × {l.label}
            </Column>
            <Column style={{ fontSize: 14, textAlign: "right" }}>{formatEuros(l.totalCents)}</Column>
          </Row>
        ))}
        {p.discountCents > 0 && (
          <Row>
            <Column style={{ fontSize: 14 }}>Remises</Column>
            <Column style={{ fontSize: 14, textAlign: "right" }}>−{formatEuros(p.discountCents)}</Column>
          </Row>
        )}
        <Row>
          <Column style={{ fontSize: 14 }}>Livraison</Column>
          <Column style={{ fontSize: 14, textAlign: "right" }}>
            {p.shippingCents === 0 ? "Offerte" : formatEuros(p.shippingCents)}
          </Column>
        </Row>
        <Row>
          <Column style={{ fontSize: 15, fontWeight: 700 }}>Total TTC payé</Column>
          <Column style={{ fontSize: 15, fontWeight: 700, textAlign: "right" }}>
            {formatEuros(p.totalCents)}
          </Column>
        </Row>
        {p.vatExempt && (
          <Text style={{ ...smallStyle, margin: "6px 0 0" }}>TVA non applicable, art. 293 B du CGI</Text>
        )}
      </Section>

      <Text style={textStyle}>
        <strong>Livraison</strong> à : {p.shippingAddress.join(", ")}.
        <br />
        Livraison estimée {p.deliveryEstimate}. Votre commande peut arriver en plusieurs colis.
      </Text>

      <Text style={smallStyle}>
        <strong>Droit de rétractation :</strong> vous disposez de 14 jours à compter de la réception pour vous
        rétracter, sans motif, via{" "}
        <Link href={`${p.shop.siteUrl}/retractation`} style={linkStyle}>
          notre formulaire en ligne
        </Link>{" "}
        ou le{" "}
        <Link href={`${p.shop.siteUrl}/cgv#formulaire-retractation`} style={linkStyle}>
          formulaire type
        </Link>
        . Les frais de retour sont à votre charge.
      </Text>
      <Text style={smallStyle}>
        <strong>Garanties :</strong> garantie légale de conformité (2 ans) et garantie des vices cachés.
      </Text>
      <Text style={smallStyle}>
        Conditions générales de vente applicables (version du {p.cgvVersion}) :{" "}
        <Link href={`${p.shop.siteUrl}/cgv`} style={linkStyle}>
          {p.shop.siteUrl}/cgv
        </Link>
        . Votre facture est jointe à cet email.
      </Text>
      <Text style={smallStyle}>
        Suivre votre commande :{" "}
        <Link href={`${p.shop.siteUrl}/suivi`} style={linkStyle}>
          {p.shop.siteUrl}/suivi
        </Link>
      </Text>
    </EmailLayout>
  );
}
