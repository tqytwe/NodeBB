<!-- IMPORT partials/account/header.tpl -->

<div component="sub2api/wallet" data-sub2api-wallet-page>
  <div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">
    <div>
      <h3 class="fw-semibold fs-5 mb-1">{{tx("sub2api-sso:sso-wallet")}}</h3>
      <p class="text-muted mb-0">{{tx("sub2api-sso:sso-wallet-introduction")}}</p>
    </div>
    <button type="button" class="btn btn-outline-primary btn-sm" data-action="sub2api-wallet-refresh">
      <i class="fa fa-refresh me-1"></i>{{tx("sub2api-sso:sso-wallet-refresh")}}
    </button>
  </div>

  <div class="alert alert-danger d-none" role="alert" data-sub2api-wallet-error></div>
  <div class="alert alert-warning d-none" role="alert" data-sub2api-wallet-unbound>
    {{tx("sub2api-sso:sso-wallet-unbound")}}
  </div>
  <div class="text-muted py-4" data-sub2api-wallet-loading>
    <i class="fa fa-spinner fa-spin me-1"></i>{{tx("sub2api-sso:sso-wallet-loading")}}
  </div>

  <div class="row g-3 d-none" data-sub2api-wallet-content>
    <div class="col-12 col-md-6 col-xl-3">
      <div class="card h-100 border-0 shadow-sm sub2api-wallet-card">
        <div class="card-body">
          <div class="text-muted small">{{tx("sub2api-sso:sso-wallet-available")}}</div>
          <div class="fs-3 fw-bold mt-1" data-sub2api-wallet-balance>¥0.00</div>
          <div class="small text-muted" data-sub2api-wallet-currency>CNY</div>
        </div>
      </div>
    </div>
    <div class="col-12 col-md-6 col-xl-3">
      <div class="card h-100 border-0 shadow-sm sub2api-wallet-card">
        <div class="card-body">
          <div class="text-muted small">{{tx("sub2api-sso:sso-wallet-frozen")}}</div>
          <div class="fs-3 fw-bold mt-1" data-sub2api-wallet-frozen>¥0.00</div>
          <div class="small text-muted">{{tx("sub2api-sso:sso-wallet-frozen-hint")}}</div>
        </div>
      </div>
    </div>
    <div class="col-12 col-md-6 col-xl-3">
      <div class="card h-100 border-0 shadow-sm sub2api-wallet-card">
        <div class="card-body">
          <div class="text-muted small">{{tx("sub2api-sso:sso-wallet-vip")}}</div>
          <div class="fs-3 fw-bold mt-1" data-sub2api-wallet-vip>V0</div>
          <div class="small text-muted"><span data-sub2api-wallet-bonus>0%</span> {{tx("sub2api-sso:sso-wallet-bonus")}}</div>
        </div>
      </div>
    </div>
    <div class="col-12 col-md-6 col-xl-3">
      <div class="card h-100 border-0 shadow-sm sub2api-wallet-card">
        <div class="card-body">
          <div class="text-muted small">{{tx("sub2api-sso:sso-wallet-user-id")}}</div>
          <div class="fs-3 fw-bold mt-1" data-sub2api-wallet-user-id>—</div>
          <div class="small text-muted">{{tx("sub2api-sso:sso-wallet-live")}}</div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- IMPORT partials/account/footer.tpl -->
