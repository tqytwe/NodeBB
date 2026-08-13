'use strict'

const user = require.main.require('./src/user')
const helpers = require.main.require('./src/controllers/helpers')
const accountHelpers = require.main.require('./src/controllers/accounts/helpers')

const controllers = {}

controllers.renderWallet = async function (req, res) {
  const ownSlug = await user.getUserField(req.uid, 'userslug')
  if (req.params.userslug !== ownSlug) {
    return res.redirect(`/user/${ownSlug}/sub2api-wallet`)
  }

  const userData = await accountHelpers.getUserDataByUserSlug(ownSlug, req.uid, req.query)
  const { username, userslug } = await user.getUserFields(req.uid, ['username', 'userslug'])
  res.render('account/sub2api-wallet', {
    ...userData,
    title: '[[sub2api-sso:sso-wallet]]',
    breadcrumbs: helpers.buildBreadcrumbs([
      { text: username, url: `/user/${userslug}` },
      { text: '[[sub2api-sso:sso-wallet]]' },
    ]),
  })
}

module.exports = controllers
