const { sanitizeRequest } = require('../../src/middleware/input-sanitizer')

describe('Input Sanitizer Middleware', () => {
  it('should escape harmful characters for body, query, params, and headers', () => {
    const req = {
      body: {
        name: '<script>alert(1)</script>',
        nested: { comment: 'hello & goodbye' },
        $bad: 'value'
      },
      query: {
        search: 'test<value>'
      },
      params: {
        id: '123<45>'
      },
      headers: {
        'x-user-email': 'john<doe>@wits.ac.za'
      }
    }
    const res = {}
    const next = jest.fn()

    sanitizeRequest(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.body.name).toBe('&lt;script&gt;alert(1)&lt;&#x2F;script&gt;')
    expect(req.body.nested.comment).toBe('hello &amp; goodbye')
    expect(req.body.bad).toBe('value')
    expect(req.query.search).toBe('test&lt;value&gt;')
    expect(req.params.id).toBe('123&lt;45&gt;')
    expect(req.headers['x-user-email']).toBe('john&lt;doe&gt;@wits.ac.za')
  })
})