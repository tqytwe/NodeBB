<li class="sub2api-user-info" component="sub2api/header-info">
  {{{ if loggedIn }}}
  <span class="sub2api-vip-badge vip-{sub2api.vipTier}" data-sub2api-vip-badge>
    <i class="fa fa-crown"></i>
    <span data-sub2api-vip>{sub2api.vipLabel}</span>
  </span>
  <span class="sub2api-wallet-info">
    <i class="fa fa-wallet"></i>
    <span data-sub2api-balance>Y{sub2api.balance}</span>
  </span>
  {{{ end }}}
</li>
