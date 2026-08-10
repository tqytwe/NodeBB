'use strict'

/* global $, app, config, socket, ajaxify, require */

(function () {
  // Every plugin route lives under the write API mount point. Getting this
  // wrong is a silent 404: the router handed to static:api.routes is mounted at
  // /api/v3/plugins by src/routes/write/index.js.
  var API_BASE = config.relative_path + '/api/v3/plugins/sub2api'

  function platformOrigin() {
    return (config.sub2api && config.sub2api.platformOrigin) || null
  }

  function ajaxHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-csrf-token': config.csrf_token,
    }
  }

  function embedded() {
    return window.parent !== window
  }

  // -------------------------------------------------------------------------
  // Header badge. The plugin used to ship templates/client/header.tpl, but that
  // path does not exist in NodeBB v4 (harmony's header is templates/header.tpl)
  // and the file was an <li> fragment, not a renderable template. Injecting
  // client-side keeps this theme-agnostic.
  // -------------------------------------------------------------------------
  function renderBadge(data) {
    if (!data || !data.bound) return

    $('.sub2api-user-info').remove()

    var $anchor = $('[component="header/avatar"]').first()
    if (!$anchor.length) return

    var $wrap = $('<li class="sub2api-user-info nav-item d-flex align-items-center"></li>')
    $wrap.append(
      $('<span class="sub2api-vip-badge" data-sub2api-vip-badge></span>')
        .addClass('vip-' + data.vipTier)
        .append('<i class="fa fa-crown"></i>')
        .append($('<span data-sub2api-vip></span>').text(data.vipLabel))
    )
    $wrap.append(
      $('<span class="sub2api-wallet-info"></span>')
        .append('<i class="fa fa-wallet"></i>')
        .append($('<span data-sub2api-balance></span>').text('¥' + data.balance))
    )

    var $li = $anchor.closest('li')
    if ($li.length) {
      $wrap.insertBefore($li)
    } else {
      $wrap.insertBefore($anchor)
    }
  }

  function loadBadge() {
    if (!config.loggedIn) return
    $.ajax({ url: API_BASE + '/me', method: 'GET' })
      .done(renderBadge)
      .fail(function () { /* badge is decorative, stay quiet */ })
  }

  // -------------------------------------------------------------------------
  // Parent-frame messaging
  // -------------------------------------------------------------------------
  function handleParentToken(payload) {
    if (!payload || !payload.token) return
    $.ajax({
      url: API_BASE + '/auto-login',
      method: 'POST',
      headers: ajaxHeaders(),
      data: JSON.stringify({ access_token: payload.token }),
    }).done(function () {
      window.location.reload()
    }).fail(function () { /* stay anonymous */ })
  }

  function handleLanguageChange(payload) {
    if (!payload || !payload.lang) return
    $.ajax({
      url: config.relative_path + '/api/v3/users/' + config.uid + '/settings',
      method: 'PUT',
      headers: ajaxHeaders(),
      data: JSON.stringify({ settings: { userLang: payload.lang } }),
    }).done(function () {
      window.location.reload()
    }).fail(function () { /* ignore */ })
  }

  function initMessaging() {
    if (!embedded()) return

    window.addEventListener('message', function (event) {
      // The old check compared event.origin against the forum's own origin,
      // which can never match the platform (community.jisudeng.com vs
      // jisudeng.com), so every message was dropped. Compare against the
      // configured platform origin instead.
      var expected = platformOrigin()
      if (!expected || event.origin !== expected) return

      var data = event.data
      if (!data || !data.type) return

      if (data.type === 'SUB2API_AUTH_TOKEN') handleParentToken(data.payload)
      if (data.type === 'SUB2API_CHANGE_LANG') handleLanguageChange(data.payload)
    })
  }

  // -------------------------------------------------------------------------
  // Realtime updates
  // -------------------------------------------------------------------------
  function initSockets() {
    if (typeof socket === 'undefined') return

    socket.on('event:sub2api-balance-updated', function (data) {
      $('[data-sub2api-balance]').text('¥' + data.balance)
      if (data.change > 0) {
        translate('[[sub2api-sso:sso-balance-updated, ' + data.balance + ']]', function (msg) {
          app.alertSuccess(msg)
        })
      }
    })

    socket.on('event:sub2api-vip-updated', function (data) {
      $('[data-sub2api-vip]').text(data.label)
      $('[data-sub2api-vip-badge]')
        .attr('class', 'sub2api-vip-badge vip-' + data.tier)
    })

    socket.on('event:forum-purchase-success', function () {
      translate('[[sub2api-sso:sso-payment-success]]', function (msg) {
        app.alertSuccess(msg)
      })
      setTimeout(function () { window.location.reload() }, 1500)
    })
  }

  function translate(key, cb) {
    try {
      require(['translator'], function (translator) {
        translator.translate(key, cb)
      })
    } catch (e) {
      cb(key)
    }
  }

  // -------------------------------------------------------------------------
  // Purchase button
  // -------------------------------------------------------------------------
  function initPayButton() {
    $('body').on('click', '[data-action="sub2api-pay"]', function (e) {
      e.preventDefault()

      var $btn = $(this)
      var itemId = $btn.data('item-id')
      var itemType = $btn.data('item-type')
      var amount = parseFloat($btn.data('amount'))

      if (!itemId || !itemType || !amount || amount <= 0) {
        translate('[[sub2api-sso:sso-param-error]]', function (msg) { app.alertError(msg) })
        return
      }

      var originalText = $btn.text()
      $btn.prop('disabled', true)
      translate('[[sub2api-sso:sso-processing]]', function (msg) { $btn.text(msg) })

      $.ajax({
        url: API_BASE + '/create-order',
        method: 'POST',
        headers: ajaxHeaders(),
        data: JSON.stringify({ item_id: itemId, item_type: itemType, amount: amount }),
      }).done(function (data) {
        if (!data || !data.payment_url) {
          translate('[[sub2api-sso:sso-order-failed]]', function (msg) { app.alertError(msg) })
          $btn.prop('disabled', false).text(originalText)
          return
        }
        var expected = platformOrigin()
        if (embedded() && expected) {
          // Never broadcast the payment URL with '*'; target the platform only.
          window.parent.postMessage({
            type: 'OPEN_PLATFORM_PAYMENT',
            payload: { url: data.payment_url },
          }, expected)
        } else {
          window.location.href = data.payment_url
        }
      }).fail(function () {
        translate('[[sub2api-sso:sso-order-failed]]', function (msg) { app.alertError(msg) })
        $btn.prop('disabled', false).text(originalText)
      })
    })
  }

  $(document).ready(function () {
    initMessaging()
    initSockets()
    initPayButton()
    loadBadge()

    // Re-inject after client-side navigation, which replaces the header.
    $(window).on('action:ajaxify.end', loadBadge)
  })
}())
