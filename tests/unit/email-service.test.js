describe('emailService', () => {
  const originalEnv = { ...process.env }
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    global.fetch = originalFetch
  })

  afterAll(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  function loadService ({ nodeEnv = 'test', env = {}, dbReadyState = 0, dbSettings = null } = {}) {
    process.env.NODE_ENV = nodeEnv
    Object.assign(process.env, env)

    const appendFileSync = jest.fn()
    const createTransport = jest.fn().mockReturnValue({
      sendMail: jest.fn().mockResolvedValue({})
    })
    const findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(dbSettings)
    })

    jest.doMock('fs', () => ({ appendFileSync }))
    jest.doMock('nodemailer', () => ({ createTransport }))
    jest.doMock('mongoose', () => ({ connection: { readyState: dbReadyState } }))
    jest.doMock('../../src/models/emailSettings', () => ({ findOne }))

    return {
      service: require('../../src/utils/emailService'),
      appendFileSync,
      createTransport,
      findOne
    }
  }

  it('suppresses notifications when a user has opted out', async () => {
    const { service, appendFileSync, createTransport } = loadService()

    await service.sendNotification(
      { email: 'student@wits.ac.za', emailNotifications: false },
      'Subject',
      'Body'
    )

    expect(appendFileSync).not.toHaveBeenCalled()
    expect(createTransport).not.toHaveBeenCalled()
  })

  it('logs simulated email when SMTP is not configured', async () => {
    const { service, appendFileSync, createTransport } = loadService({ nodeEnv: 'development' })

    await service.sendPasswordResetEmail('student@wits.ac.za', '123456', 'https://example.test/reset')

    expect(createTransport).not.toHaveBeenCalled()
    expect(appendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('email-log.txt'),
      expect.stringContaining('TO: student@wits.ac.za | SUBJECT: Consultation Scheduler - Password Reset'),
      'utf8'
    )
  })

  it('sends real mail with environment SMTP configuration outside tests', async () => {
    const { service, createTransport, appendFileSync } = loadService({
      nodeEnv: 'development',
      env: {
        SMTP_HOST: 'smtp.example.test',
        SMTP_PORT: '2525',
        SMTP_SECURE: 'true',
        SMTP_USER: 'sender@example.test',
        SMTP_PASS: 'secret',
        SMTP_FROM: 'no-reply@example.test'
      }
    })

    await service.sendNotification(
      { email: 'lecturer@wits.ac.za', emailNotifications: true },
      'New booking',
      'A student booked your slot'
    )

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.test',
      port: 2525,
      secure: true,
      auth: {
        user: 'sender@example.test',
        pass: 'secret'
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    })
    expect(createTransport.mock.results[0].value.sendMail).toHaveBeenCalledWith({
      from: 'no-reply@example.test',
      to: 'lecturer@wits.ac.za',
      subject: 'New booking',
      text: 'A student booked your slot'
    })
    expect(appendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('email-log.txt'),
      expect.stringContaining('TO: lecturer@wits.ac.za | SUBJECT: New booking'),
      'utf8'
    )
  })

  it('loads enabled SMTP settings from the database when env config is absent', async () => {
    const { service, createTransport, findOne } = loadService({
      nodeEnv: 'development',
      dbReadyState: 1,
      dbSettings: {
        service: '',
        host: 'smtp.db.test',
        port: 587,
        secure: false,
        user: 'db@example.test',
        pass: 'db-secret',
        from: 'db-from@example.test'
      }
    })

    await service.sendNotification(
      { email: 'lecturer@wits.ac.za', emailNotifications: true },
      'Subject',
      'Body'
    )

    expect(findOne).toHaveBeenCalledWith({ name: 'default', enabled: true })
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.db.test',
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      auth: {
        user: 'db@example.test',
        pass: 'db-secret'
      }
    }))
  })

  it('logs failed real email attempts locally', async () => {
    const { service, createTransport, appendFileSync } = loadService({
      nodeEnv: 'development',
      env: {
        EMAIL_USER: 'sender@gmail.com',
        EMAIL_PASS: 'secret'
      }
    })
    createTransport.mockReturnValueOnce({
      sendMail: jest.fn().mockRejectedValue(new Error('SMTP down'))
    })

    await service.sendNotification(
      { email: 'lecturer@wits.ac.za', emailNotifications: true },
      'Subject',
      'Body'
    )

    expect(createTransport).toHaveBeenCalledWith({
      service: 'gmail',
      auth: {
        user: 'sender@gmail.com',
        pass: 'secret'
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    })
    expect(appendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('email-log.txt'),
      expect.stringContaining('TO: lecturer@wits.ac.za | SUBJECT: Subject'),
      'utf8'
    )
  })

  it('sends real mail with Brevo API configuration outside tests', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('')
    })
    const { service, createTransport, appendFileSync } = loadService({
      nodeEnv: 'development',
      env: {
        BREVO_API_KEY: 'xkeysib-test-key',
        EMAIL_FROM: 'Consultation Scheduler <no-reply@example.test>'
      }
    })

    await service.sendNotification(
      { email: 'lecturer@wits.ac.za', emailNotifications: true },
      'New booking',
      'A student booked your slot'
    )

    expect(createTransport).not.toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': 'xkeysib-test-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          email: 'no-reply@example.test',
          name: 'Consultation Scheduler'
        },
        to: [{ email: 'lecturer@wits.ac.za' }],
        subject: 'New booking',
        textContent: 'A student booked your slot'
      })
    })
    expect(appendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('email-log.txt'),
      expect.stringContaining('TO: lecturer@wits.ac.za | SUBJECT: New booking'),
      'utf8'
    )
  })

  it('removes spaces from Gmail app passwords pasted from the Google UI', async () => {
    const { service, createTransport } = loadService({
      nodeEnv: 'development',
      env: {
        EMAIL_USER: ' "sender@gmail.com" ',
        EMAIL_PASS: ' "abcd efgh ijkl mnop" ',
        EMAIL_SERVICE: ' "gmail" '
      }
    })

    await service.sendNotification(
      { email: 'lecturer@wits.ac.za', emailNotifications: true },
      'Subject',
      'Body'
    )

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      service: 'gmail',
      auth: {
        user: 'sender@gmail.com',
        pass: 'abcdefghijklmnop'
      }
    }))
  })

  it('returns when SMTP hangs instead of waiting forever', async () => {
    const { service, createTransport, appendFileSync } = loadService({
      nodeEnv: 'development',
      env: {
        EMAIL_USER: 'sender@gmail.com',
        EMAIL_PASS: 'secret',
        EMAIL_TIMEOUT_MS: '5'
      }
    })
    createTransport.mockReturnValueOnce({
      sendMail: jest.fn(() => new Promise(() => {}))
    })

    const result = await service.sendNotification(
      { email: 'lecturer@wits.ac.za', emailNotifications: true },
      'Subject',
      'Body'
    )

    expect(result.sent).toBe(false)
    expect(result.error).toContain('timed out')
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      connectionTimeout: 5,
      greetingTimeout: 5,
      socketTimeout: 5
    }))
    expect(appendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('email-log.txt'),
      expect.stringContaining('TO: lecturer@wits.ac.za | SUBJECT: Subject'),
      'utf8'
    )
  })
})
