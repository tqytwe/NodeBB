'use strict'

const user = require.main.require('./src/user')
const helpers = require.main.require('./src/controllers/helpers')

const controllers = {}

controllers.renderWallet = async function (req, res) {
  if (res.locals.uid !== req.uid) {
    return helpers.notAllowed(req, res)
  }

  const { username, userslug } = await user.getUserFields(res.locals.uid, ['username', 'userslug'])
  res.render('account/sub2api-wallet', {
    ...res.locals.userData,
    title: '[[sub2api-sso:sso-wallet]]',
    breadcrumbs: helpers.buildBreadcrumbs([
      { text: username, url: `/user/${userslug}` },
      { text: '[[sub2api-sso:sso-wallet]]' },
    ]),
  })
}

module.exports = controllers
