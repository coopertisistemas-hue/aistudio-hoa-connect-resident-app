import Card from '@/components/base/Card';

export default function PaymentGuidance() {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-foreground-800 mb-3">Como pagar sua fatura</h4>
      <div className="space-y-2">
        <Card variant="outlined" className="p-3">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <i className="ri-barcode-line text-primary-600 text-lg" />
            </div>
            <div>
              <h5 className="text-sm font-medium text-foreground-800 mb-0.5">Pagamento por boleto</h5>
              <p className="text-xs text-foreground-500 leading-relaxed">
                Você pode pagar o boleto pelo internet banking, aplicativo do banco ou em casas lotéricas. O pagamento pode levar até 2 dias úteis para ser identificado.
              </p>
            </div>
          </div>
        </Card>

        <Card variant="outlined" className="p-3">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <i className="ri-qr-code-line text-primary-600 text-lg" />
            </div>
            <div>
              <h5 className="text-sm font-medium text-foreground-800 mb-0.5">Pagamento por PIX</h5>
              <p className="text-xs text-foreground-500 leading-relaxed">
                Copie o código PIX e cole no aplicativo do seu banco. A identificação costuma ser mais rápida, mas pode levar até 1 dia útil.
              </p>
            </div>
          </div>
        </Card>

        <Card variant="outlined" className="p-3">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <i className="ri-information-line text-primary-600 text-lg" />
            </div>
            <div>
              <h5 className="text-sm font-medium text-foreground-800 mb-0.5">Importante saber</h5>
              <ul className="text-xs text-foreground-500 leading-relaxed space-y-1 list-disc pl-4">
                <li>Não realize o pagamento de faturas substituídas ou canceladas.</li>
                <li>Se já pagou e a fatura ainda aparece como pendente, utilize a opção "Informar pagamento".</li>
                <li>A segunda via tem a mesma validade da fatura original.</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}