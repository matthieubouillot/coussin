import { Button, Link, Text } from "react-email";
import { formatEuros } from "@/lib/money";
import { EmailLayout, linkStyle, smallStyle, textStyle, type EmailShop } from "./EmailLayout";

// Emails déclenchés par le cycle de vie de la commande. Ton factuel : jamais de fausse urgence.

const buttonStyle = {
  backgroundColor: "#6b4a35",
  color: "#ffffff",
  borderRadius: 999,
  padding: "12px 20px",
  fontSize: 15,
  textDecoration: "none",
} as const;

export function ShippedEmail(p: {
  shop: EmailShop;
  orderNumber: string;
  customerName: string;
  parcelIndex: number;
  parcelCount: number;
  itemsLabel: string;
  carrier: string | null;
  trackingNumber: string;
  trackingUrl: string | null;
  deliveryEstimate: string;
}) {
  const parcel = p.parcelCount > 1 ? ` (colis ${p.parcelIndex}/${p.parcelCount})` : "";
  return (
    <EmailLayout preview={`Commande ${p.orderNumber} expédiée${parcel}`} shop={p.shop}>
      <Text style={textStyle}>Bonjour {p.customerName},</Text>
      <Text style={textStyle}>
        Bonne nouvelle : votre commande <strong>{p.orderNumber}</strong> est en route{parcel}. Ce colis
        contient : {p.itemsLabel}.
      </Text>
      <Text style={textStyle}>
        Transporteur : {p.carrier ?? "communiqué par le suivi"} — numéro de suivi :{" "}
        <strong>{p.trackingNumber}</strong>
        <br />
        Livraison estimée {p.deliveryEstimate}.
      </Text>
      {p.trackingUrl && (
        <Button href={p.trackingUrl} style={buttonStyle}>
          Suivre mon colis
        </Button>
      )}
    </EmailLayout>
  );
}

export function DeliveredEmail(p: { shop: EmailShop; orderNumber: string; customerName: string }) {
  return (
    <EmailLayout preview={`Commande ${p.orderNumber} livrée`} shop={p.shop}>
      <Text style={textStyle}>Bonjour {p.customerName},</Text>
      <Text style={textStyle}>
        Votre commande <strong>{p.orderNumber}</strong> a été livrée. Nous espérons que votre animal
        appréciera son nouveau coussin.
      </Text>
      <Text style={smallStyle}>
        Un souci ? Répondez simplement à cet email. Vous disposez de 14 jours à compter de la réception pour
        exercer votre droit de rétractation.
      </Text>
    </EmailLayout>
  );
}

export function ReviewRequestEmail(p: {
  shop: EmailShop;
  orderNumber: string;
  customerName: string;
  reviewUrl: string;
}) {
  return (
    <EmailLayout preview="Votre avis sur votre coussin" shop={p.shop}>
      <Text style={textStyle}>Bonjour {p.customerName},</Text>
      <Text style={textStyle}>
        Vous avez reçu votre commande <strong>{p.orderNumber}</strong> il y a quelques jours. Votre avis,
        positif ou négatif, aide les autres propriétaires d&apos;animaux à choisir.
      </Text>
      <Button href={p.reviewUrl} style={buttonStyle}>
        Donner mon avis
      </Button>
      <Text style={{ ...smallStyle, marginTop: 16 }}>
        Ce lien est personnel. Aucune contrepartie n&apos;est accordée en échange d&apos;un avis.{" "}
        <Link href={`${p.shop.siteUrl}/avis-clients`} style={linkStyle}>
          Comment nous contrôlons les avis
        </Link>
        . Vous ne souhaitez plus recevoir ce type d&apos;email ? Répondez « STOP ».
      </Text>
    </EmailLayout>
  );
}

export function RefundEmail(p: {
  shop: EmailShop;
  orderNumber: string;
  customerName: string;
  amountCents: number;
  creditNoteNumber: string | null;
}) {
  return (
    <EmailLayout preview={`Remboursement de ${formatEuros(p.amountCents)}`} shop={p.shop}>
      <Text style={textStyle}>Bonjour {p.customerName},</Text>
      <Text style={textStyle}>
        Nous avons procédé au remboursement de <strong>{formatEuros(p.amountCents)}</strong> pour votre
        commande <strong>{p.orderNumber}</strong>, sur le moyen de paiement utilisé lors de l&apos;achat.
        Selon votre banque, il apparaît sur votre compte sous 5 à 10 jours ouvrés.
      </Text>
      {p.creditNoteNumber && (
        <Text style={smallStyle}>Avoir correspondant : {p.creditNoteNumber} (joint).</Text>
      )}
    </EmailLayout>
  );
}

export function DelayNoticeEmail(p: {
  shop: EmailShop;
  orderNumber: string;
  customerName: string;
  newEstimate: string;
}) {
  return (
    <EmailLayout preview={`Commande ${p.orderNumber} : nouveau délai de livraison`} shop={p.shop}>
      <Text style={textStyle}>Bonjour {p.customerName},</Text>
      <Text style={textStyle}>
        Nous préférons vous prévenir : la livraison de votre commande <strong>{p.orderNumber}</strong> prendra
        plus de temps que prévu. Nouvelle estimation : {p.newEstimate}.
      </Text>
      <Text style={textStyle}>
        Si ce délai ne vous convient pas, répondez à cet email : nous pouvons annuler la commande et vous
        rembourser intégralement.
      </Text>
    </EmailLayout>
  );
}

export function WithdrawalAckEmail(p: {
  shop: EmailShop;
  orderNumber: string;
  customerName: string;
  returnAddress: string;
}) {
  return (
    <EmailLayout preview={`Rétractation reçue — commande ${p.orderNumber}`} shop={p.shop}>
      <Text style={textStyle}>Bonjour {p.customerName},</Text>
      <Text style={textStyle}>
        Nous accusons réception de votre demande de rétractation pour la commande{" "}
        <strong>{p.orderNumber}</strong>.
      </Text>
      <Text style={textStyle}>
        Merci de nous renvoyer le produit au plus tard 14 jours après cette demande, à l&apos;adresse suivante
        : <strong>{p.returnAddress}</strong>. Les frais de retour sont à votre charge ; conservez la preuve
        d&apos;expédition.
      </Text>
      <Text style={smallStyle}>
        Nous vous rembourserons, frais de livraison initiaux compris, au plus tard 14 jours après réception de
        votre demande ; le remboursement peut être différé jusqu&apos;à réception du produit ou de la preuve
        de son expédition.
      </Text>
    </EmailLayout>
  );
}

/** Message interne (vers l'admin) : jamais envoyé à un client. */
export function AdminNotificationEmail(p: { shop: EmailShop; title: string; lines: string[] }) {
  return (
    <EmailLayout preview={p.title} shop={p.shop}>
      <Text style={{ ...textStyle, fontWeight: 700 }}>{p.title}</Text>
      {p.lines.map((line, i) => (
        <Text key={i} style={{ ...textStyle, whiteSpace: "pre-wrap" }}>
          {line}
        </Text>
      ))}
    </EmailLayout>
  );
}
