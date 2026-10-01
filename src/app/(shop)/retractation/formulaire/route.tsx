import { Document, Page, StyleSheet, Text, renderToBuffer } from "@react-pdf/renderer";
import { getShopConfig } from "@/server/settings/settings";

// Modèle de formulaire de rétractation (annexe à l'article R221-1 du Code de la consommation).
const s = StyleSheet.create({
  page: { padding: 50, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.6 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 12 },
  p: { marginBottom: 10 },
});

export async function GET(): Promise<Response> {
  const { legal } = await getShopConfig();
  const pdf = await renderToBuffer(
    <Document title="Formulaire de rétractation">
      <Page size="A4" style={s.page}>
        <Text style={s.title}>Modèle de formulaire de rétractation</Text>
        <Text style={s.p}>
          (Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du
          contrat.)
        </Text>
        <Text style={s.p}>
          À l&apos;attention de {legal.sellerName}, {legal.address}, {legal.email} :
        </Text>
        <Text style={s.p}>
          Je/Nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant
          sur la vente du bien (*) ci-dessous :
        </Text>
        <Text style={s.p}>Commandé le (*) / reçu le (*) : ..............................</Text>
        <Text style={s.p}>Numéro de commande : ..............................</Text>
        <Text style={s.p}>Nom du (des) consommateur(s) : ..............................</Text>
        <Text style={s.p}>Adresse du (des) consommateur(s) : ..............................</Text>
        <Text style={s.p}>
          Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur
          papier) :
        </Text>
        <Text style={s.p}>Date : ..............................</Text>
        <Text style={s.p}>(*) Rayez la mention inutile.</Text>
      </Page>
    </Document>,
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="formulaire-retractation.pdf"',
    },
  });
}
