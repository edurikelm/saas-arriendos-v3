import { http, HttpResponse } from 'msw';

/**
 * MSW handlers for Mercado Pago API (v1).
 * These intercept calls to https://api.mercadopago.com during tests.
 */
export const mspHandlers = [
  // GET /v1/payments/{id}
  http.get('https://api.mercadopago.com/v1/payments/:id', ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      status: 'approved',
      status_detail: 'accredited',
      external_reference: 'res-1:pay-1:123456',
      preference_id: 'pref-1',
      date_approved: '2026-01-01T00:00:00.000Z',
      date_created: '2026-01-01T00:00:00.000Z',
      payment_method_id: 'visa',
      payment_type: 'credit_card',
      transaction_amount: 100.0,
      net_received_amount: 95.0,
      fee_details: [{ type: 'commission', amount: 5.0 }],
      installments: 1,
      card: { last_four_digits: '1234', first_six_digits: '411111', cardholder: { name: 'TEST USER' } },
    });
  }),

  // GET /merchant_orders/{id}
  http.get('https://api.mercadopago.com/merchant_orders/:id', ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      external_reference: 'res-1:pay-1:123456',
      payments: [
        { id: 'mp-pay-1', status: 'approved', preference_id: 'pref-1' },
      ],
    });
  }),
];
