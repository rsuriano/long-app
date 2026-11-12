import { GateForm } from "@/components/GateForm";

export const metadata = { title: "Long — private preview" };

export default function Page() {
  return (
    <section className="screen">
      <div className="gate">
        <div className="brand" style={{ fontSize: 28 }}>
          <span className="dot" />Long
        </div>
        <p className="gate-tag">Go long on what you believe in.</p>
        <GateForm />
        <p className="tiny gate-foot">
          Private preview. Tokenized stocks are issued by Coinbase on Base and are available only to
          eligible users outside the United States. Nothing here is investment advice.
        </p>
      </div>
    </section>
  );
}
