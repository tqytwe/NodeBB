'use strict'

$(document).ready(function () {
  if (window.parent !== window) {
    window.addEventListener('message', function (event) {
      try {
        var currentURL = new URL(window.location.origin)
        var eventURL = new URL(event.origin)
        if (currentURL.hostname !== eventURL.hostname) return
      } catch (e) { return }

      var data = event.data
      if (!data || !data.type) return
      if (data.type === 'SUB2API_AUTH_TOKEN') handleParentToken(data.payload)
      if (data.type === 'SUB2API_CHANGE_LANG') handleLanguageChange(data.payload)
    })
  }

  if (typeof socket !== 'undefined') {
    socket.on('event:sub2api-balance-updated', function (data) {
      $('[data-sub2api-balance]').text('Y' + data.balance)
      if (data.change > 0) app.alertSuccess('Y' + data.balance)
    })
    socket.on('event:sub2api-vip-updated', function (data) {
      $('[data-sub2api-vip]').text(data.label)
      $('[data-sub2api-vip-badge]').removeClass().addClass('sub2api-vip-badge vip-' + data.tier)
    })
    socket.on('event:forum-purchase-success', function () {
      app.alertSuccess('payment success')
      setTimeout(function () { location.reload() }, 1500)
    })
  }

  $('body').on('click', '[data-action="sub2api-pay"]', function (e) {
    e.preventDefault()
    var $btn = $(this)
    var itemId = $btn.data('item-id')
    var itemType = $btn.data('item-type')
    var amount = parseFloat($btn.data('amount'))
    if (!itemId || !itemType || !amount) { app.alertError('param error'); return }
    $btn.prop('disabled', true).text('processing...')
    $.ajax({
      url: config.relative_path + '/api/sub2api/create-order',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': config.csrf_token },
      data: JSON.stringify({ item_id: itemId, item_type: itemType, amount: amount }),
      success: function (data) {
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'OPEN_PLATFORM_PAYMENT', payload: { url: data.payment_url } }, '*')
        } else {
          window.location.href = data.payment_url
        }
      },
      error: function (xhr) { app.alertError('order failed'); $btn.prop('disabled', false).text('retry') }
    })
  })
})

async function handleParentToken(payload) {
  if (!payload || !payload.token) return
  try {
    var resp = await fetch(config.relative_path + '/api/sub2api/auto-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: payload.token })
    })
    if (resp.ok) window.location.reload()
  } catch (e) {}
}

async function handleLanguageChange(payload) {
  if (!payload || !payload.lang) return
  try {
    await $.ajax({
      url: config.relative_path + '/api/user/language',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': config.csrf_token },
      data: JSON.stringify({ language: payload.lang })
    })
    window.location.reload()
  } catch (e) {}
}
