import { useGetMyInvoices, usePayInvoice } from "@workspace/api-client-react";
import { FileText, CreditCard, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function ClientInvoices() {
  const { data: invoices, isLoading } = useGetMyInvoices();
  const payMutation = usePayInvoice();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handlePay = (id: string) => {
    payMutation.mutate({ id, data: { method: "stripe" } }, {
      onSuccess: () => {
        toast({ title: "Payment Initiated", description: "Redirecting to secure gateway..." });
        // Normally redirect to Stripe URL here
        queryClient.invalidateQueries({ queryKey: [`/api/invoices`] });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Invoices</h2>
        <p className="text-muted-foreground mt-1">View and pay your billing statements.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-xl shadow-black/5 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-secondary/40 border-b border-border">
                  <th className="p-4 font-medium text-muted-foreground text-sm">Invoice #</th>
                  <th className="p-4 font-medium text-muted-foreground text-sm">Date Generated</th>
                  <th className="p-4 font-medium text-muted-foreground text-sm">Due Date</th>
                  <th className="p-4 font-medium text-muted-foreground text-sm">Total</th>
                  <th className="p-4 font-medium text-muted-foreground text-sm">Status</th>
                  <th className="p-4 font-medium text-muted-foreground text-sm text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices?.map(inv => (
                  <tr key={inv.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="p-4 font-bold text-foreground flex items-center gap-2">
                      <FileText size={16} className="text-muted-foreground"/> {inv.invoiceNumber}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{format(new Date(inv.createdAt), 'MMM d, yyyy')}</td>
                    <td className="p-4 text-sm text-muted-foreground">{format(new Date(inv.dueDate), 'MMM d, yyyy')}</td>
                    <td className="p-4 font-medium">${inv.total.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                        inv.status === 'unpaid' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                        'bg-secondary text-muted-foreground border-border'
                      }`}>
                        {inv.status === 'paid' ? <CheckCircle size={12}/> : inv.status === 'unpaid' ? <AlertCircle size={12}/> : null}
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {inv.status === 'unpaid' ? (
                        <Button 
                          size="sm" 
                          className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-lg shadow-primary/20"
                          onClick={() => handlePay(inv.id)}
                          disabled={payMutation.isPending}
                        >
                          <CreditCard size={14} /> Pay Now
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="bg-background border-border">
                          Download PDF
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {invoices?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      No invoices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
