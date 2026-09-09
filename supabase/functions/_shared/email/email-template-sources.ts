/**
 * Runtime-safe template sources for Edge Function deployments.
 * The repository also keeps the canonical HTML files for editing and tests.
 */
export const EMAIL_TEMPLATE_SOURCES = {
  'student-payment-confirmed': String.raw`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Pagamento confirmado - MAZZI</title>

  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #1f2128;
      color: #ffffff;
      font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Arial,
        sans-serif;
    }

    table {
      border-collapse: collapse;
      border-spacing: 0;
    }

    img {
      border: 0;
      display: block;
      outline: none;
      text-decoration: none;
    }

    .container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
    }

    .button {
      display: inline-block;
      background-color: #f6c945;
      color: #2c2f38 !important;
      text-decoration: none;
      font-size: 14px;
      line-height: 18px;
      font-weight: 800;
      padding: 16px 28px;
      border-radius: 14px;
    }

    @media only screen and (max-width: 620px) {
      .outer-padding {
        padding-left: 12px !important;
        padding-right: 12px !important;
      }

      .content-padding {
        padding-left: 22px !important;
        padding-right: 22px !important;
      }

      .amount {
        font-size: 36px !important;
        line-height: 40px !important;
      }

      .button {
        display: block !important;
        text-align: center !important;
      }
    }
  </style>
</head>

<body>

  <!-- PREHEADER -->
  <div
    style="
      display:none;
      max-height:0;
      overflow:hidden;
      opacity:0;
      color:transparent;
      visibility:hidden;
    "
  >
    Seu pagamento foi confirmado e sua aula já está agendada no MAZZI.
  </div>

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="background-color:#1f2128;"
  >
    <tr>
      <td
        align="center"
        class="outer-padding"
        style="padding:40px 20px;"
      >

        <!-- CONTAINER PRINCIPAL -->
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          class="container"
          style="
            width:100%;
            max-width:600px;
            background-color:#2c2f38;
            border-radius:18px;
            overflow:hidden;
          "
        >

          <!-- HEADER -->
          <tr>
            <td
              style="
                padding:22px 28px;
                background-color:#f6c945;
              "
            >

              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
              >
                <tr>

                  <td
                    width="52"
                    valign="middle"
                    style="width:52px;"
                  >
                    <img
                      src="{{mazzi_logo_src}}"
                      width="48"
                      height="48"
                      alt="MAZZI"
                      style="
                        width:48px;
                        height:48px;
                        display:block;
                      "
                    >
                  </td>

                  <td
                    valign="middle"
                    style="padding-left:12px;"
                  >

                    <div
                      style="
                        color:#2c2f38;
                        font-size:18px;
                        line-height:20px;
                        font-weight:900;
                        letter-spacing:-0.4px;
                      "
                    >
                      MAZZI
                    </div>

                    <div
                      style="
                        margin-top:3px;
                        color:#2c2f38;
                        font-size:11px;
                        line-height:15px;
                        font-weight:600;
                        opacity:.72;
                      "
                    >
                      Sua jornada, no seu ritmo.
                    </div>

                  </td>

                </tr>
              </table>

            </td>
          </tr>

          <!-- STATUS -->
          <tr>
            <td
              align="center"
              class="content-padding"
              style="padding:42px 48px 16px 48px;"
            >

              <div
                style="
                  width:54px;
                  height:54px;
                  line-height:54px;
                  margin:0 auto 20px auto;
                  background-color:#f6c945;
                  border-radius:16px;
                  color:#2c2f38;
                  font-size:25px;
                  font-weight:900;
                  text-align:center;
                "
              >
                ✓
              </div>

              <h1
                style="
                  margin:0;
                  color:#ffffff;
                  font-size:28px;
                  line-height:32px;
                  font-weight:800;
                  letter-spacing:-1px;
                "
              >
                Pagamento confirmado
              </h1>

              <p
                style="
                  margin:12px 0 0 0;
                  color:#b8b7b2;
                  font-size:16px;
                  line-height:24px;
                  font-weight:400;
                "
              >
                Olá, {{student_name}}! Seu pagamento foi aprovado e sua aula já está confirmada.
              </p>

            </td>
          </tr>

          <!-- TOTAL PAGO -->
          <tr>
            <td
              align="center"
              style="padding:12px 20px 34px 20px;"
            >

              <div
                style="
                  margin-bottom:4px;
                  color:#b8b7b2;
                  font-size:12px;
                  line-height:18px;
                  font-weight:500;
                "
              >
                Total pago
              </div>

              <div
                class="amount"
                style="
                  color:#f6c945;
                  font-size:38px;
                  line-height:42px;
                  font-weight:800;
                  letter-spacing:-1.6px;
                "
              >
                {{total_paid}}
              </div>

            </td>
          </tr>

          <!-- DADOS DA AULA -->
          <tr>
            <td
              class="content-padding"
              style="padding:0 48px 24px 48px;"
            >

              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  width:100%;
                  background-color:#33363f;
                  border-radius:16px;
                "
              >
                <tr>
                  <td style="padding:24px;">

                    <div
                      style="
                        margin-bottom:20px;
                        color:#f6c945;
                        font-size:10px;
                        line-height:13px;
                        font-weight:700;
                        letter-spacing:1.2px;
                        text-transform:uppercase;
                      "
                    >
                      Sua aula
                    </div>

                    <!-- PROFISSIONAL -->
                    <div
                      style="
                        margin-bottom:4px;
                        color:#aaa9a4;
                        font-size:12px;
                        line-height:18px;
                        font-weight:500;
                      "
                    >
                      Profissional
                    </div>

                    <div
                      style="
                        margin-bottom:24px;
                        color:#ffffff;
                        font-size:20px;
                        line-height:24px;
                        font-weight:800;
                        letter-spacing:-0.5px;
                      "
                    >
                      {{provider_name}}
                    </div>

                    <!-- DATA / HORÁRIO / CATEGORIA -->
                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                    >

                      <tr>
                        <td
                          style="
                            width:34%;
                            padding:0 0 14px 0;
                            color:#aaa9a4;
                            font-size:13px;
                            line-height:19px;
                          "
                        >
                          Data
                        </td>

                        <td
                          align="right"
                          style="
                            padding:0 0 14px 12px;
                            color:#ffffff;
                            font-size:14px;
                            line-height:19px;
                            font-weight:600;
                          "
                        >
                          {{lesson_date}}
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            padding:0 0 14px 0;
                            color:#aaa9a4;
                            font-size:13px;
                            line-height:19px;
                          "
                        >
                          Horário
                        </td>

                        <td
                          align="right"
                          style="
                            padding:0 0 14px 12px;
                            color:#ffffff;
                            font-size:14px;
                            line-height:19px;
                            font-weight:600;
                          "
                        >
                          {{lesson_start_time}} às {{lesson_end_time}}
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            color:#aaa9a4;
                            font-size:13px;
                            line-height:19px;
                          "
                        >
                          Categoria
                        </td>

                        <td
                          align="right"
                          style="
                            padding-left:12px;
                            color:#f6c945;
                            font-size:14px;
                            line-height:19px;
                            font-weight:700;
                          "
                        >
                          Categoria {{license_category}}
                        </td>
                      </tr>

                    </table>

                    <div style="height:22px;line-height:22px;">
                      &nbsp;
                    </div>

                    <!-- VEÍCULO -->
                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                      style="
                        width:100%;
                        background-color:#24262d;
                        border-radius:14px;
                      "
                    >
                      <tr>
                        <td style="padding:18px;">

                          <div
                            style="
                              margin-bottom:9px;
                              color:#f6c945;
                              font-size:10px;
                              line-height:13px;
                              font-weight:700;
                              letter-spacing:1px;
                              text-transform:uppercase;
                            "
                          >
                            Veículo da aula
                          </div>

                          <div
                            style="
                              margin-bottom:16px;
                              color:#ffffff;
                              font-size:16px;
                              line-height:21px;
                              font-weight:800;
                            "
                          >
                            {{vehicle_brand}} {{vehicle_model}}
                          </div>

                          <table
                            role="presentation"
                            width="100%"
                            cellspacing="0"
                            cellpadding="0"
                            border="0"
                          >

                            <tr>
                              <td
                                style="
                                  padding:0 0 9px 0;
                                  color:#aaa9a4;
                                  font-size:12px;
                                  line-height:18px;
                                "
                              >
                                Ano
                              </td>

                              <td
                                align="right"
                                style="
                                  padding:0 0 9px 12px;
                                  color:#ffffff;
                                  font-size:13px;
                                  line-height:18px;
                                  font-weight:600;
                                "
                              >
                                {{vehicle_year}}
                              </td>
                            </tr>

                            <tr>
                              <td
                                style="
                                  padding:0 0 9px 0;
                                  color:#aaa9a4;
                                  font-size:12px;
                                  line-height:18px;
                                "
                              >
                                Câmbio
                              </td>

                              <td
                                align="right"
                                style="
                                  padding:0 0 9px 12px;
                                  color:#ffffff;
                                  font-size:13px;
                                  line-height:18px;
                                  font-weight:600;
                                "
                              >
                                {{vehicle_transmission}}
                              </td>
                            </tr>

                            <tr>
                              <td
                                style="
                                  color:#aaa9a4;
                                  font-size:12px;
                                  line-height:18px;
                                "
                              >
                                Cor
                              </td>

                              <td
                                align="right"
                                style="
                                  padding-left:12px;
                                  color:#ffffff;
                                  font-size:13px;
                                  line-height:18px;
                                  font-weight:600;
                                "
                              >
                                {{vehicle_color}}
                              </td>
                            </tr>

                          </table>

                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- RESUMO DO PAGAMENTO -->
          <tr>
            <td
              class="content-padding"
              style="padding:8px 48px 30px 48px;"
            >

              <div
                style="
                  margin-bottom:17px;
                  color:#ffffff;
                  font-size:18px;
                  line-height:22px;
                  font-weight:800;
                "
              >
                Resumo do pagamento
              </div>

              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
              >

                <tr>
                  <td
                    style="
                      padding:11px 0;
                      color:#aaa9a4;
                      border-bottom:1px solid #454851;
                      font-size:13px;
                      line-height:19px;
                    "
                  >
                    Valor da aula
                  </td>

                  <td
                    align="right"
                    style="
                      padding:11px 0;
                      color:#ffffff;
                      border-bottom:1px solid #454851;
                      font-size:14px;
                      line-height:19px;
                      font-weight:600;
                    "
                  >
                    {{lesson_amount}}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:15px 0 0 0;
                      color:#ffffff;
                      font-size:14px;
                      line-height:20px;
                      font-weight:700;
                    "
                  >
                    Total pago
                  </td>

                  <td
                    align="right"
                    style="
                      padding:15px 0 0 0;
                      color:#f6c945;
                      font-size:16px;
                      line-height:20px;
                      font-weight:800;
                    "
                  >
                    {{total_paid}}
                  </td>
                </tr>

              </table>

            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td
              align="center"
              class="content-padding"
              style="padding:4px 48px 38px 48px;"
            >

              <a
                href="{{lesson_url}}"
                class="button"
                style="
                  display:inline-block;
                  padding:16px 28px;
                  background-color:#f6c945;
                  border-radius:14px;
                  color:#2c2f38;
                  text-decoration:none;
                  font-size:14px;
                  line-height:18px;
                  font-weight:800;
                "
              >
                Ver minha aula
              </a>

              <p
                style="
                  margin:17px 0 0 0;
                  color:#999991;
                  font-size:12px;
                  line-height:18px;
                "
              >
                Você também pode acompanhar todos os detalhes pelo aplicativo MAZZI Aluno.
              </p>

            </td>
          </tr>

          <!-- REFERÊNCIA -->
          <tr>
            <td
              align="center"
              style="
                padding:20px 30px;
                background-color:#24262d;
              "
            >

              <div
                style="
                  color:#999991;
                  font-size:10px;
                  line-height:14px;
                  font-weight:500;
                  letter-spacing:.5px;
                  text-transform:uppercase;
                "
              >
                Identificação do pagamento
              </div>

              <div
                style="
                  margin-top:5px;
                  color:#ffffff;
                  font-family:
                    ui-monospace,
                    SFMono-Regular,
                    Menlo,
                    Monaco,
                    Consolas,
                    'Liberation Mono',
                    'Courier New',
                    monospace;
                  font-size:11px;
                  line-height:16px;
                  font-weight:500;
                "
              >
                {{payment_reference}}
              </div>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td
              align="center"
              style="
                padding:28px 30px 31px 30px;
                background-color:#191b20;
              "
            >

              <table
                role="presentation"
                cellspacing="0"
                cellpadding="0"
                border="0"
                align="center"
              >
                <tr>

                  <td valign="middle">
                    <img
                      src="{{mazzi_logo_src}}"
                      width="34"
                      height="34"
                      alt="MAZZI"
                      style="
                        width:34px;
                        height:34px;
                        display:block;
                      "
                    >
                  </td>

                  <td
                    valign="middle"
                    style="
                      padding-left:10px;
                      color:#ffffff;
                      font-size:16px;
                      line-height:18px;
                      font-weight:900;
                    "
                  >
                    MAZZI
                  </td>

                </tr>
              </table>

              <p
                style="
                  margin:16px 0 0 0;
                  color:#b8b7b2;
                  font-size:11px;
                  line-height:17px;
                "
              >
                Este é um e-mail automático relacionado a uma transação realizada no MAZZI.
              </p>

              <p
                style="
                  margin:6px 0 0 0;
                  color:#77766f;
                  font-size:10px;
                  line-height:16px;
                "
              >
                Nunca solicitaremos sua senha, código de acesso ou dados completos de pagamento por e-mail.
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`,
  'student-cancellation-refund': String.raw`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Cancelamento confirmado - MAZZI</title>

  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #1f2128;
      color: #ffffff;
      font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Arial,
        sans-serif;
    }

    table {
      border-collapse: collapse;
      border-spacing: 0;
    }

    img {
      border: 0;
      display: block;
      outline: none;
      text-decoration: none;
    }

    .container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
    }

    .button {
      display: inline-block;
      background-color: #f6c945;
      color: #2c2f38 !important;
      text-decoration: none;
      font-size: 14px;
      line-height: 18px;
      font-weight: 800;
      padding: 16px 28px;
      border-radius: 14px;
    }

    @media only screen and (max-width: 620px) {
      .outer-padding {
        padding-left: 12px !important;
        padding-right: 12px !important;
      }

      .content-padding {
        padding-left: 22px !important;
        padding-right: 22px !important;
      }

      .amount {
        font-size: 36px !important;
        line-height: 40px !important;
      }

      .button {
        display: block !important;
        text-align: center !important;
      }
    }
  </style>
</head>

<body>

  <!-- PREHEADER -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Sua aula foi cancelada e o estorno foi solicitado.
  </div>

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="background-color:#1f2128;"
  >
    <tr>
      <td
        align="center"
        class="outer-padding"
        style="padding:40px 20px;"
      >

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          class="container"
          style="
            width:100%;
            max-width:600px;
            background-color:#2c2f38;
            border-radius:18px;
            overflow:hidden;
          "
        >

          <!-- HEADER -->
          <tr>
            <td
              style="
                padding:22px 28px;
                background-color:#f6c945;
              "
            >
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
              >
                <tr>

                  <td width="52" valign="middle">
                    <img
                      src="{{mazzi_logo_src}}"
                      width="48"
                      height="48"
                      alt="MAZZI"
                      style="width:48px;height:48px;display:block;"
                    >
                  </td>

                  <td valign="middle" style="padding-left:12px;">

                    <div
                      style="
                        color:#2c2f38;
                        font-size:18px;
                        line-height:20px;
                        font-weight:900;
                        letter-spacing:-0.4px;
                      "
                    >
                      MAZZI
                    </div>

                    <div
                      style="
                        margin-top:3px;
                        color:#2c2f38;
                        font-size:11px;
                        line-height:15px;
                        font-weight:600;
                        opacity:.72;
                      "
                    >
                      Sua jornada, no seu ritmo.
                    </div>

                  </td>

                </tr>
              </table>

            </td>
          </tr>

          <!-- STATUS -->
          <tr>
            <td
              align="center"
              class="content-padding"
              style="padding:42px 48px 16px 48px;"
            >

              <div
                style="
                  width:54px;
                  height:54px;
                  line-height:54px;
                  margin:0 auto 20px auto;
                  background-color:#f6c945;
                  border-radius:16px;
                  color:#2c2f38;
                  font-size:24px;
                  font-weight:900;
                  text-align:center;
                "
              >
                ↩
              </div>

              <h1
                style="
                  margin:0;
                  color:#ffffff;
                  font-size:28px;
                  line-height:32px;
                  font-weight:800;
                  letter-spacing:-1px;
                "
              >
                Cancelamento confirmado
              </h1>

              <p
                style="
                  margin:12px 0 0 0;
                  color:#b8b7b2;
                  font-size:16px;
                  line-height:24px;
                  font-weight:400;
                "
              >
                Olá, {{student_name}}! Sua aula foi cancelada e o estorno já foi solicitado.
              </p>

            </td>
          </tr>

          <!-- VALOR DO ESTORNO -->
          <tr>
            <td
              align="center"
              style="padding:12px 20px 34px 20px;"
            >

              <div
                style="
                  margin-bottom:4px;
                  color:#b8b7b2;
                  font-size:12px;
                  line-height:18px;
                  font-weight:500;
                "
              >
                Valor do estorno
              </div>

              <div
                class="amount"
                style="
                  color:#f6c945;
                  font-size:38px;
                  line-height:42px;
                  font-weight:800;
                  letter-spacing:-1.6px;
                "
              >
                {{refund_amount}}
              </div>

            </td>
          </tr>

          <!-- AULA CANCELADA -->
          <tr>
            <td
              class="content-padding"
              style="padding:0 48px 24px 48px;"
            >

              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  width:100%;
                  background-color:#33363f;
                  border-radius:16px;
                "
              >
                <tr>
                  <td style="padding:24px;">

                    <div
                      style="
                        margin-bottom:20px;
                        color:#f6c945;
                        font-size:10px;
                        line-height:13px;
                        font-weight:700;
                        letter-spacing:1.2px;
                        text-transform:uppercase;
                      "
                    >
                      Aula cancelada
                    </div>

                    <!-- PROFISSIONAL -->
                    <div
                      style="
                        margin-bottom:4px;
                        color:#aaa9a4;
                        font-size:12px;
                        line-height:18px;
                        font-weight:500;
                      "
                    >
                      Profissional
                    </div>

                    <div
                      style="
                        margin-bottom:24px;
                        color:#ffffff;
                        font-size:20px;
                        line-height:24px;
                        font-weight:800;
                        letter-spacing:-0.5px;
                      "
                    >
                      {{provider_name}}
                    </div>

                    <!-- DATA / HORÁRIO / CATEGORIA -->
                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                    >

                      <tr>
                        <td
                          style="
                            width:34%;
                            padding:0 0 14px 0;
                            color:#aaa9a4;
                            font-size:13px;
                            line-height:19px;
                          "
                        >
                          Data
                        </td>

                        <td
                          align="right"
                          style="
                            padding:0 0 14px 12px;
                            color:#ffffff;
                            font-size:14px;
                            line-height:19px;
                            font-weight:600;
                          "
                        >
                          {{lesson_date}}
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            padding:0 0 14px 0;
                            color:#aaa9a4;
                            font-size:13px;
                            line-height:19px;
                          "
                        >
                          Horário
                        </td>

                        <td
                          align="right"
                          style="
                            padding:0 0 14px 12px;
                            color:#ffffff;
                            font-size:14px;
                            line-height:19px;
                            font-weight:600;
                          "
                        >
                          {{lesson_start_time}} às {{lesson_end_time}}
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            color:#aaa9a4;
                            font-size:13px;
                            line-height:19px;
                          "
                        >
                          Categoria
                        </td>

                        <td
                          align="right"
                          style="
                            padding-left:12px;
                            color:#f6c945;
                            font-size:14px;
                            line-height:19px;
                            font-weight:700;
                          "
                        >
                          Categoria {{license_category}}
                        </td>
                      </tr>

                    </table>

                    <div style="height:22px;line-height:22px;">&nbsp;</div>

                    <!-- VEÍCULO -->
                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                      style="
                        width:100%;
                        background-color:#24262d;
                        border-radius:14px;
                      "
                    >
                      <tr>
                        <td style="padding:18px;">

                          <div
                            style="
                              margin-bottom:9px;
                              color:#f6c945;
                              font-size:10px;
                              line-height:13px;
                              font-weight:700;
                              letter-spacing:1px;
                              text-transform:uppercase;
                            "
                          >
                            Veículo da aula
                          </div>

                          <div
                            style="
                              margin-bottom:16px;
                              color:#ffffff;
                              font-size:16px;
                              line-height:21px;
                              font-weight:800;
                            "
                          >
                            {{vehicle_brand}} {{vehicle_model}}
                          </div>

                          <table
                            role="presentation"
                            width="100%"
                            cellspacing="0"
                            cellpadding="0"
                            border="0"
                          >

                            <tr>
                              <td
                                style="
                                  padding:0 0 9px 0;
                                  color:#aaa9a4;
                                  font-size:12px;
                                  line-height:18px;
                                "
                              >
                                Ano
                              </td>

                              <td
                                align="right"
                                style="
                                  padding:0 0 9px 12px;
                                  color:#ffffff;
                                  font-size:13px;
                                  line-height:18px;
                                  font-weight:600;
                                "
                              >
                                {{vehicle_year}}
                              </td>
                            </tr>

                            <tr>
                              <td
                                style="
                                  padding:0 0 9px 0;
                                  color:#aaa9a4;
                                  font-size:12px;
                                  line-height:18px;
                                "
                              >
                                Câmbio
                              </td>

                              <td
                                align="right"
                                style="
                                  padding:0 0 9px 12px;
                                  color:#ffffff;
                                  font-size:13px;
                                  line-height:18px;
                                  font-weight:600;
                                "
                              >
                                {{vehicle_transmission}}
                              </td>
                            </tr>

                            <tr>
                              <td
                                style="
                                  color:#aaa9a4;
                                  font-size:12px;
                                  line-height:18px;
                                "
                              >
                                Cor
                              </td>

                              <td
                                align="right"
                                style="
                                  padding-left:12px;
                                  color:#ffffff;
                                  font-size:13px;
                                  line-height:18px;
                                  font-weight:600;
                                "
                              >
                                {{vehicle_color}}
                              </td>
                            </tr>

                          </table>

                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- RESUMO DO ESTORNO -->
          <tr>
            <td
              class="content-padding"
              style="padding:8px 48px 30px 48px;"
            >

              <div
                style="
                  margin-bottom:17px;
                  color:#ffffff;
                  font-size:18px;
                  line-height:22px;
                  font-weight:800;
                "
              >
                Resumo do estorno
              </div>

              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
              >

                <tr>
                  <td
                    style="
                      padding:11px 0;
                      color:#aaa9a4;
                      border-bottom:1px solid #454851;
                      font-size:13px;
                      line-height:19px;
                    "
                  >
                    Valor pago
                  </td>

                  <td
                    align="right"
                    style="
                      padding:11px 0;
                      color:#ffffff;
                      border-bottom:1px solid #454851;
                      font-size:14px;
                      line-height:19px;
                      font-weight:600;
                    "
                  >
                    {{amount_paid}}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:11px 0;
                      color:#aaa9a4;
                      border-bottom:1px solid #454851;
                      font-size:13px;
                      line-height:19px;
                    "
                  >
                    Valor do estorno
                  </td>

                  <td
                    align="right"
                    style="
                      padding:11px 0;
                      color:#f6c945;
                      border-bottom:1px solid #454851;
                      font-size:14px;
                      line-height:19px;
                      font-weight:700;
                    "
                  >
                    {{refund_amount}}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:15px 0 0 0;
                      color:#ffffff;
                      font-size:14px;
                      line-height:20px;
                      font-weight:700;
                    "
                  >
                    Status
                  </td>

                  <td
                    align="right"
                    style="
                      padding:15px 0 0 0;
                      color:#ffffff;
                      font-size:14px;
                      line-height:20px;
                      font-weight:700;
                    "
                  >
                    Estorno solicitado
                  </td>
                </tr>

              </table>

              <p
                style="
                  margin:22px 0 0 0;
                  color:#b8b7b2;
                  font-size:12px;
                  line-height:19px;
                "
              >
                O valor será devolvido para a mesma forma de pagamento utilizada na compra.
                O prazo para aparecer pode variar de acordo com a instituição financeira.
              </p>

            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td
              align="center"
              class="content-padding"
              style="padding:4px 48px 38px 48px;"
            >

              <a
                href="{{refund_details_url}}"
                class="button"
                style="
                  display:inline-block;
                  padding:16px 28px;
                  background-color:#f6c945;
                  border-radius:14px;
                  color:#2c2f38;
                  text-decoration:none;
                  font-size:14px;
                  line-height:18px;
                  font-weight:800;
                "
              >
                Ver detalhes
              </a>

              <p
                style="
                  margin:17px 0 0 0;
                  color:#999991;
                  font-size:12px;
                  line-height:18px;
                "
              >
                Você pode acompanhar o cancelamento e o pagamento pelo aplicativo MAZZI Aluno.
              </p>

            </td>
          </tr>

          <!-- REFERÊNCIA -->
          <tr>
            <td
              align="center"
              style="
                padding:20px 30px;
                background-color:#24262d;
              "
            >

              <div
                style="
                  color:#999991;
                  font-size:10px;
                  line-height:14px;
                  font-weight:500;
                  letter-spacing:.5px;
                  text-transform:uppercase;
                "
              >
                Identificação do pagamento
              </div>

              <div
                style="
                  margin-top:5px;
                  color:#ffffff;
                  font-family:
                    ui-monospace,
                    SFMono-Regular,
                    Menlo,
                    Monaco,
                    Consolas,
                    'Liberation Mono',
                    'Courier New',
                    monospace;
                  font-size:11px;
                  line-height:16px;
                  font-weight:500;
                "
              >
                {{payment_reference}}
              </div>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td
              align="center"
              style="
                padding:28px 30px 31px 30px;
                background-color:#191b20;
              "
            >

              <table
                role="presentation"
                cellspacing="0"
                cellpadding="0"
                border="0"
                align="center"
              >
                <tr>

                  <td valign="middle">
                    <img
                      src="{{mazzi_logo_src}}"
                      width="34"
                      height="34"
                      alt="MAZZI"
                      style="width:34px;height:34px;display:block;"
                    >
                  </td>

                  <td
                    valign="middle"
                    style="
                      padding-left:10px;
                      color:#ffffff;
                      font-size:16px;
                      line-height:18px;
                      font-weight:900;
                    "
                  >
                    MAZZI
                  </td>

                </tr>
              </table>

              <p
                style="
                  margin:16px 0 0 0;
                  color:#b8b7b2;
                  font-size:11px;
                  line-height:17px;
                "
              >
                Este é um e-mail automático relacionado a uma transação realizada no MAZZI.
              </p>

              <p
                style="
                  margin:6px 0 0 0;
                  color:#77766f;
                  font-size:10px;
                  line-height:16px;
                "
              >
                Nunca solicitaremos sua senha, código de acesso ou dados completos de pagamento por e-mail.
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`,
  'student-refund-completed': String.raw`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Estorno concluído - MAZZI</title>

  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #1f2128;
      color: #ffffff;
      font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Arial,
        sans-serif;
    }

    table {
      border-collapse: collapse;
      border-spacing: 0;
    }

    img {
      border: 0;
      display: block;
      outline: none;
      text-decoration: none;
    }

    .container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
    }

    .button {
      display: inline-block;
      background-color: #f6c945;
      color: #2c2f38 !important;
      text-decoration: none;
      font-size: 14px;
      line-height: 18px;
      font-weight: 800;
      padding: 16px 28px;
      border-radius: 14px;
    }

    @media only screen and (max-width: 620px) {
      .outer-padding {
        padding-left: 12px !important;
        padding-right: 12px !important;
      }

      .content-padding {
        padding-left: 22px !important;
        padding-right: 22px !important;
      }

      .amount {
        font-size: 36px !important;
        line-height: 40px !important;
      }

      .button {
        display: block !important;
        text-align: center !important;
      }
    }
  </style>
</head>

<body>

  <!-- PREHEADER -->
  <div
    style="
      display:none;
      max-height:0;
      overflow:hidden;
      opacity:0;
      color:transparent;
      visibility:hidden;
    "
  >
    Seu estorno foi concluído.
  </div>

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="background-color:#1f2128;"
  >
    <tr>
      <td
        align="center"
        class="outer-padding"
        style="padding:40px 20px;"
      >

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          class="container"
          style="
            width:100%;
            max-width:600px;
            background-color:#2c2f38;
            border-radius:18px;
            overflow:hidden;
          "
        >

          <!-- HEADER -->
          <tr>
            <td
              style="
                padding:22px 28px;
                background-color:#f6c945;
              "
            >
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
              >
                <tr>

                  <td width="52" valign="middle">
                    <img
                      src="{{mazzi_logo_src}}"
                      width="48"
                      height="48"
                      alt="MAZZI"
                      style="width:48px;height:48px;display:block;"
                    >
                  </td>

                  <td valign="middle" style="padding-left:12px;">

                    <div
                      style="
                        color:#2c2f38;
                        font-size:18px;
                        line-height:20px;
                        font-weight:900;
                        letter-spacing:-0.4px;
                      "
                    >
                      MAZZI
                    </div>

                    <div
                      style="
                        margin-top:3px;
                        color:#2c2f38;
                        font-size:11px;
                        line-height:15px;
                        font-weight:600;
                        opacity:.72;
                      "
                    >
                      Sua jornada, no seu ritmo.
                    </div>

                  </td>

                </tr>
              </table>

            </td>
          </tr>

          <!-- STATUS -->
          <tr>
            <td
              align="center"
              class="content-padding"
              style="padding:42px 48px 16px 48px;"
            >

              <div
                style="
                  width:54px;
                  height:54px;
                  line-height:54px;
                  margin:0 auto 20px auto;
                  background-color:#f6c945;
                  border-radius:16px;
                  color:#2c2f38;
                  font-size:25px;
                  font-weight:900;
                  text-align:center;
                "
              >
                ✓
              </div>

              <h1
                style="
                  margin:0;
                  color:#ffffff;
                  font-size:28px;
                  line-height:32px;
                  font-weight:800;
                  letter-spacing:-1px;
                "
              >
                Estorno concluído
              </h1>

              <p
                style="
                  margin:12px 0 0 0;
                  color:#b8b7b2;
                  font-size:16px;
                  line-height:24px;
                  font-weight:400;
                "
              >
                Olá, {{student_name}}! O estorno referente à sua aula foi concluído.
              </p>

            </td>
          </tr>

          <!-- VALOR DO ESTORNO -->
          <tr>
            <td
              align="center"
              style="padding:12px 20px 34px 20px;"
            >

              <div
                style="
                  margin-bottom:4px;
                  color:#b8b7b2;
                  font-size:12px;
                  line-height:18px;
                  font-weight:500;
                "
              >
                Valor estornado
              </div>

              <div
                class="amount"
                style="
                  color:#f6c945;
                  font-size:38px;
                  line-height:42px;
                  font-weight:800;
                  letter-spacing:-1.6px;
                "
              >
                {{refund_amount}}
              </div>

            </td>
          </tr>

          <!-- AULA CANCELADA -->
          <tr>
            <td
              class="content-padding"
              style="padding:0 48px 24px 48px;"
            >

              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  width:100%;
                  background-color:#33363f;
                  border-radius:16px;
                "
              >
                <tr>
                  <td style="padding:24px;">

                    <div
                      style="
                        margin-bottom:20px;
                        color:#f6c945;
                        font-size:10px;
                        line-height:13px;
                        font-weight:700;
                        letter-spacing:1.2px;
                        text-transform:uppercase;
                      "
                    >
                      Aula cancelada
                    </div>

                    <!-- PROFISSIONAL -->
                    <div
                      style="
                        margin-bottom:4px;
                        color:#aaa9a4;
                        font-size:12px;
                        line-height:18px;
                        font-weight:500;
                      "
                    >
                      Profissional
                    </div>

                    <div
                      style="
                        margin-bottom:24px;
                        color:#ffffff;
                        font-size:20px;
                        line-height:24px;
                        font-weight:800;
                        letter-spacing:-0.5px;
                      "
                    >
                      {{provider_name}}
                    </div>

                    <!-- DATA / HORÁRIO / CATEGORIA -->
                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                    >

                      <tr>
                        <td
                          style="
                            width:34%;
                            padding:0 0 14px 0;
                            color:#aaa9a4;
                            font-size:13px;
                            line-height:19px;
                          "
                        >
                          Data
                        </td>

                        <td
                          align="right"
                          style="
                            padding:0 0 14px 12px;
                            color:#ffffff;
                            font-size:14px;
                            line-height:19px;
                            font-weight:600;
                          "
                        >
                          {{lesson_date}}
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            padding:0 0 14px 0;
                            color:#aaa9a4;
                            font-size:13px;
                            line-height:19px;
                          "
                        >
                          Horário
                        </td>

                        <td
                          align="right"
                          style="
                            padding:0 0 14px 12px;
                            color:#ffffff;
                            font-size:14px;
                            line-height:19px;
                            font-weight:600;
                          "
                        >
                          {{lesson_start_time}} às {{lesson_end_time}}
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            color:#aaa9a4;
                            font-size:13px;
                            line-height:19px;
                          "
                        >
                          Categoria
                        </td>

                        <td
                          align="right"
                          style="
                            padding-left:12px;
                            color:#f6c945;
                            font-size:14px;
                            line-height:19px;
                            font-weight:700;
                          "
                        >
                          Categoria {{license_category}}
                        </td>
                      </tr>

                    </table>

                    <div style="height:22px;line-height:22px;">&nbsp;</div>

                    <!-- VEÍCULO -->
                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                      style="
                        width:100%;
                        background-color:#24262d;
                        border-radius:14px;
                      "
                    >
                      <tr>
                        <td style="padding:18px;">

                          <div
                            style="
                              margin-bottom:9px;
                              color:#f6c945;
                              font-size:10px;
                              line-height:13px;
                              font-weight:700;
                              letter-spacing:1px;
                              text-transform:uppercase;
                            "
                          >
                            Veículo da aula
                          </div>

                          <div
                            style="
                              margin-bottom:16px;
                              color:#ffffff;
                              font-size:16px;
                              line-height:21px;
                              font-weight:800;
                            "
                          >
                            {{vehicle_brand}} {{vehicle_model}}
                          </div>

                          <table
                            role="presentation"
                            width="100%"
                            cellspacing="0"
                            cellpadding="0"
                            border="0"
                          >

                            <tr>
                              <td
                                style="
                                  padding:0 0 9px 0;
                                  color:#aaa9a4;
                                  font-size:12px;
                                  line-height:18px;
                                "
                              >
                                Ano
                              </td>

                              <td
                                align="right"
                                style="
                                  padding:0 0 9px 12px;
                                  color:#ffffff;
                                  font-size:13px;
                                  line-height:18px;
                                  font-weight:600;
                                "
                              >
                                {{vehicle_year}}
                              </td>
                            </tr>

                            <tr>
                              <td
                                style="
                                  padding:0 0 9px 0;
                                  color:#aaa9a4;
                                  font-size:12px;
                                  line-height:18px;
                                "
                              >
                                Câmbio
                              </td>

                              <td
                                align="right"
                                style="
                                  padding:0 0 9px 12px;
                                  color:#ffffff;
                                  font-size:13px;
                                  line-height:18px;
                                  font-weight:600;
                                "
                              >
                                {{vehicle_transmission}}
                              </td>
                            </tr>

                            <tr>
                              <td
                                style="
                                  color:#aaa9a4;
                                  font-size:12px;
                                  line-height:18px;
                                "
                              >
                                Cor
                              </td>

                              <td
                                align="right"
                                style="
                                  padding-left:12px;
                                  color:#ffffff;
                                  font-size:13px;
                                  line-height:18px;
                                  font-weight:600;
                                "
                              >
                                {{vehicle_color}}
                              </td>
                            </tr>

                          </table>

                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- RESUMO DO ESTORNO -->
          <tr>
            <td
              class="content-padding"
              style="padding:8px 48px 30px 48px;"
            >

              <div
                style="
                  margin-bottom:17px;
                  color:#ffffff;
                  font-size:18px;
                  line-height:22px;
                  font-weight:800;
                "
              >
                Resumo do estorno
              </div>

              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
              >

                <tr>
                  <td
                    style="
                      padding:11px 0;
                      color:#aaa9a4;
                      border-bottom:1px solid #454851;
                      font-size:13px;
                      line-height:19px;
                    "
                  >
                    Valor pago
                  </td>

                  <td
                    align="right"
                    style="
                      padding:11px 0;
                      color:#ffffff;
                      border-bottom:1px solid #454851;
                      font-size:14px;
                      line-height:19px;
                      font-weight:600;
                    "
                  >
                    {{amount_paid}}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:11px 0;
                      color:#aaa9a4;
                      border-bottom:1px solid #454851;
                      font-size:13px;
                      line-height:19px;
                    "
                  >
                    Valor estornado
                  </td>

                  <td
                    align="right"
                    style="
                      padding:11px 0;
                      color:#f6c945;
                      border-bottom:1px solid #454851;
                      font-size:14px;
                      line-height:19px;
                      font-weight:700;
                    "
                  >
                    {{refund_amount}}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:15px 0 0 0;
                      color:#ffffff;
                      font-size:14px;
                      line-height:20px;
                      font-weight:700;
                    "
                  >
                    Status
                  </td>

                  <td
                    align="right"
                    style="
                      padding:15px 0 0 0;
                      color:#ffffff;
                      font-size:14px;
                      line-height:20px;
                      font-weight:700;
                    "
                  >
                    Estorno concluído
                  </td>
                </tr>

              </table>

              <p
                style="
                  margin:22px 0 0 0;
                  color:#b8b7b2;
                  font-size:12px;
                  line-height:19px;
                "
              >
                O estorno foi processado para a mesma forma de pagamento utilizada na compra.
                Dependendo da instituição financeira, o lançamento pode levar algum tempo para aparecer no extrato ou na fatura.
              </p>

            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td
              align="center"
              class="content-padding"
              style="padding:4px 48px 38px 48px;"
            >

              <a
                href="{{refund_details_url}}"
                class="button"
                style="
                  display:inline-block;
                  padding:16px 28px;
                  background-color:#f6c945;
                  border-radius:14px;
                  color:#2c2f38;
                  text-decoration:none;
                  font-size:14px;
                  line-height:18px;
                  font-weight:800;
                "
              >
                Ver detalhes
              </a>

              <p
                style="
                  margin:17px 0 0 0;
                  color:#999991;
                  font-size:12px;
                  line-height:18px;
                "
              >
                Você pode acompanhar seus pagamentos pelo aplicativo MAZZI Aluno.
              </p>

            </td>
          </tr>

          <!-- REFERÊNCIA -->
          <tr>
            <td
              align="center"
              style="
                padding:20px 30px;
                background-color:#24262d;
              "
            >

              <div
                style="
                  color:#999991;
                  font-size:10px;
                  line-height:14px;
                  font-weight:500;
                  letter-spacing:.5px;
                  text-transform:uppercase;
                "
              >
                Identificação do pagamento
              </div>

              <div
                style="
                  margin-top:5px;
                  color:#ffffff;
                  font-family:
                    ui-monospace,
                    SFMono-Regular,
                    Menlo,
                    Monaco,
                    Consolas,
                    'Liberation Mono',
                    'Courier New',
                    monospace;
                  font-size:11px;
                  line-height:16px;
                  font-weight:500;
                "
              >
                {{payment_reference}}
              </div>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td
              align="center"
              style="
                padding:28px 30px 31px 30px;
                background-color:#191b20;
              "
            >

              <table
                role="presentation"
                cellspacing="0"
                cellpadding="0"
                border="0"
                align="center"
              >
                <tr>

                  <td valign="middle">
                    <img
                      src="{{mazzi_logo_src}}"
                      width="34"
                      height="34"
                      alt="MAZZI"
                      style="width:34px;height:34px;display:block;"
                    >
                  </td>

                  <td
                    valign="middle"
                    style="
                      padding-left:10px;
                      color:#ffffff;
                      font-size:16px;
                      line-height:18px;
                      font-weight:900;
                    "
                  >
                    MAZZI
                  </td>

                </tr>
              </table>

              <p
                style="
                  margin:16px 0 0 0;
                  color:#b8b7b2;
                  font-size:11px;
                  line-height:17px;
                "
              >
                Este é um e-mail automático relacionado a uma transação realizada no MAZZI.
              </p>

              <p
                style="
                  margin:6px 0 0 0;
                  color:#77766f;
                  font-size:10px;
                  line-height:16px;
                "
              >
                Nunca solicitaremos sua senha, código de acesso ou dados completos de pagamento por e-mail.
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`,
  'pro-booking-confirmed': String.raw`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Nova aula confirmada - MAZZI</title>

  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #1f2128;
      color: #ffffff;
      font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Arial,
        sans-serif;
    }

    table {
      border-collapse: collapse;
      border-spacing: 0;
    }

    img {
      border: 0;
      display: block;
      outline: none;
      text-decoration: none;
    }

    .container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
    }

    .button {
      display: inline-block;
      background-color: #f6c945;
      color: #2c2f38 !important;
      text-decoration: none;
      font-size: 14px;
      line-height: 18px;
      font-weight: 800;
      padding: 16px 28px;
      border-radius: 14px;
    }

    @media only screen and (max-width: 620px) {
      .outer-padding {
        padding-left: 12px !important;
        padding-right: 12px !important;
      }

      .content-padding {
        padding-left: 22px !important;
        padding-right: 22px !important;
      }

      .amount {
        font-size: 36px !important;
        line-height: 40px !important;
      }

      .button {
        display: block !important;
        text-align: center !important;
      }
    }
  </style>
</head>

<body>

  <!-- PREHEADER -->
  <div
    style="
      display:none;
      max-height:0;
      overflow:hidden;
      opacity:0;
      color:transparent;
      visibility:hidden;
    "
  >
    Você recebeu uma nova aula confirmada no MAZZI.
  </div>

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="background-color:#1f2128;"
  >
    <tr>
      <td
        align="center"
        class="outer-padding"
        style="padding:40px 20px;"
      >

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          class="container"
          style="
            width:100%;
            max-width:600px;
            background-color:#2c2f38;
            border-radius:18px;
            overflow:hidden;
          "
        >

          <!-- HEADER -->
          <tr>
            <td
              style="
                padding:22px 28px;
                background-color:#f6c945;
              "
            >
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
              >
                <tr>

                  <td width="52" valign="middle">
                    <img
                      src="{{mazzi_logo_src}}"
                      width="48"
                      height="48"
                      alt="MAZZI"
                      style="width:48px;height:48px;display:block;"
                    >
                  </td>

                  <td valign="middle" style="padding-left:12px;">

                    <div
                      style="
                        color:#2c2f38;
                        font-size:18px;
                        line-height:20px;
                        font-weight:900;
                        letter-spacing:-0.4px;
                      "
                    >
                      MAZZI
                    </div>

                    <div
                      style="
                        margin-top:3px;
                        color:#2c2f38;
                        font-size:11px;
                        line-height:15px;
                        font-weight:600;
                        opacity:.72;
                      "
                    >
                      Sua jornada, no seu ritmo.
                    </div>

                  </td>

                </tr>
              </table>

            </td>
          </tr>

          <!-- STATUS -->
          <tr>
            <td
              align="center"
              class="content-padding"
              style="padding:42px 48px 16px 48px;"
            >

              <div
                style="
                  width:54px;
                  height:54px;
                  line-height:54px;
                  margin:0 auto 20px auto;
                  background-color:#f6c945;
                  border-radius:16px;
                  color:#2c2f38;
                  font-size:25px;
                  font-weight:900;
                  text-align:center;
                "
              >
                ✓
              </div>

              <h1
                style="
                  margin:0;
                  color:#ffffff;
                  font-size:28px;
                  line-height:32px;
                  font-weight:800;
                  letter-spacing:-1px;
                "
              >
                Nova aula confirmada
              </h1>

              <p
                style="
                  margin:12px 0 0 0;
                  color:#b8b7b2;
                  font-size:16px;
                  line-height:24px;
                  font-weight:400;
                "
              >
                Olá, {{provider_first_name}}! Você recebeu uma nova aula confirmada no MAZZI.
              </p>

            </td>
          </tr>

          <!-- VALOR PREVISTO -->
          <tr>
            <td
              align="center"
              style="padding:12px 20px 34px 20px;"
            >

              <div
                style="
                  margin-bottom:4px;
                  color:#b8b7b2;
                  font-size:12px;
                  line-height:18px;
                  font-weight:500;
                "
              >
                Valor previsto para você
              </div>

              <div
                class="amount"
                style="
                  color:#f6c945;
                  font-size:38px;
                  line-height:42px;
                  font-weight:800;
                  letter-spacing:-1.6px;
                "
              >
                {{provider_expected_amount}}
              </div>

            </td>
          </tr>

          <!-- AULA -->
          <tr>
            <td
              class="content-padding"
              style="padding:0 48px 24px 48px;"
            >

              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  width:100%;
                  background-color:#33363f;
                  border-radius:16px;
                "
              >
                <tr>
                  <td style="padding:24px;">

                    <div
                      style="
                        margin-bottom:20px;
                        color:#f6c945;
                        font-size:10px;
                        line-height:13px;
                        font-weight:700;
                        letter-spacing:1.2px;
                        text-transform:uppercase;
                      "
                    >
                      Sua nova aula
                    </div>

                    <!-- ALUNO -->
                    <div
                      style="
                        margin-bottom:4px;
                        color:#aaa9a4;
                        font-size:12px;
                        line-height:18px;
                        font-weight:500;
                      "
                    >
                      Aluno
                    </div>

                    <div
                      style="
                        margin-bottom:24px;
                        color:#ffffff;
                        font-size:20px;
                        line-height:24px;
                        font-weight:800;
                        letter-spacing:-0.5px;
                      "
                    >
                      {{student_name}}
                    </div>

                    <!-- DATA / HORÁRIO / CATEGORIA -->
                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                    >

                      <tr>
                        <td
                          style="
                            width:34%;
                            padding:0 0 14px 0;
                            color:#aaa9a4;
                            font-size:13px;
                            line-height:19px;
                          "
                        >
                          Data
                        </td>

                        <td
                          align="right"
                          style="
                            padding:0 0 14px 12px;
                            color:#ffffff;
                            font-size:14px;
                            line-height:19px;
                            font-weight:600;
                          "
                        >
                          {{lesson_date}}
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            padding:0 0 14px 0;
                            color:#aaa9a4;
                            font-size:13px;
                            line-height:19px;
                          "
                        >
                          Horário
                        </td>

                        <td
                          align="right"
                          style="
                            padding:0 0 14px 12px;
                            color:#ffffff;
                            font-size:14px;
                            line-height:19px;
                            font-weight:600;
                          "
                        >
                          {{lesson_start_time}} às {{lesson_end_time}}
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            color:#aaa9a4;
                            font-size:13px;
                            line-height:19px;
                          "
                        >
                          Categoria
                        </td>

                        <td
                          align="right"
                          style="
                            padding-left:12px;
                            color:#f6c945;
                            font-size:14px;
                            line-height:19px;
                            font-weight:700;
                          "
                        >
                          Categoria {{license_category}}
                        </td>
                      </tr>

                    </table>

                    <div style="height:22px;line-height:22px;">&nbsp;</div>

                    <!-- VEÍCULO -->
                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                      style="
                        width:100%;
                        background-color:#24262d;
                        border-radius:14px;
                      "
                    >
                      <tr>
                        <td style="padding:18px;">

                          <div
                            style="
                              margin-bottom:9px;
                              color:#f6c945;
                              font-size:10px;
                              line-height:13px;
                              font-weight:700;
                              letter-spacing:1px;
                              text-transform:uppercase;
                            "
                          >
                            Veículo da aula
                          </div>

                          <div
                            style="
                              margin-bottom:16px;
                              color:#ffffff;
                              font-size:16px;
                              line-height:21px;
                              font-weight:800;
                            "
                          >
                            {{vehicle_brand}} {{vehicle_model}}
                          </div>

                          <table
                            role="presentation"
                            width="100%"
                            cellspacing="0"
                            cellpadding="0"
                            border="0"
                          >

                            <tr>
                              <td
                                style="
                                  padding:0 0 9px 0;
                                  color:#aaa9a4;
                                  font-size:12px;
                                  line-height:18px;
                                "
                              >
                                Ano
                              </td>

                              <td
                                align="right"
                                style="
                                  padding:0 0 9px 12px;
                                  color:#ffffff;
                                  font-size:13px;
                                  line-height:18px;
                                  font-weight:600;
                                "
                              >
                                {{vehicle_year}}
                              </td>
                            </tr>

                            <tr>
                              <td
                                style="
                                  padding:0 0 9px 0;
                                  color:#aaa9a4;
                                  font-size:12px;
                                  line-height:18px;
                                "
                              >
                                Câmbio
                              </td>

                              <td
                                align="right"
                                style="
                                  padding:0 0 9px 12px;
                                  color:#ffffff;
                                  font-size:13px;
                                  line-height:18px;
                                  font-weight:600;
                                "
                              >
                                {{vehicle_transmission}}
                              </td>
                            </tr>

                            <tr>
                              <td
                                style="
                                  color:#aaa9a4;
                                  font-size:12px;
                                  line-height:18px;
                                "
                              >
                                Cor
                              </td>

                              <td
                                align="right"
                                style="
                                  padding-left:12px;
                                  color:#ffffff;
                                  font-size:13px;
                                  line-height:18px;
                                  font-weight:600;
                                "
                              >
                                {{vehicle_color}}
                              </td>
                            </tr>

                          </table>

                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- RESUMO FINANCEIRO -->
          <tr>
            <td
              class="content-padding"
              style="padding:8px 48px 30px 48px;"
            >

              <div
                style="
                  margin-bottom:17px;
                  color:#ffffff;
                  font-size:18px;
                  line-height:22px;
                  font-weight:800;
                "
              >
                Resumo financeiro
              </div>

              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
              >

                <tr>
                  <td
                    style="
                      padding:11px 0;
                      color:#aaa9a4;
                      border-bottom:1px solid #454851;
                      font-size:13px;
                      line-height:19px;
                    "
                  >
                    Valor da aula
                  </td>

                  <td
                    align="right"
                    style="
                      padding:11px 0;
                      color:#ffffff;
                      border-bottom:1px solid #454851;
                      font-size:14px;
                      line-height:19px;
                      font-weight:600;
                    "
                  >
                    {{lesson_amount}}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:11px 0;
                      color:#aaa9a4;
                      border-bottom:1px solid #454851;
                      font-size:13px;
                      line-height:19px;
                    "
                  >
                    Taxa MAZZI
                  </td>

                  <td
                    align="right"
                    style="
                      padding:11px 0;
                      color:#ffffff;
                      border-bottom:1px solid #454851;
                      font-size:14px;
                      line-height:19px;
                      font-weight:600;
                    "
                  >
                    {{mazzi_fee_amount}}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:15px 0 0 0;
                      color:#ffffff;
                      font-size:14px;
                      line-height:20px;
                      font-weight:700;
                    "
                  >
                    Valor previsto para você
                  </td>

                  <td
                    align="right"
                    style="
                      padding:15px 0 0 0;
                      color:#f6c945;
                      font-size:16px;
                      line-height:20px;
                      font-weight:800;
                    "
                  >
                    {{provider_expected_amount}}
                  </td>
                </tr>

              </table>

              <p
                style="
                  margin:22px 0 0 0;
                  color:#b8b7b2;
                  font-size:12px;
                  line-height:19px;
                "
              >
                Este valor ainda não representa um repasse realizado.
                A liberação seguirá as regras financeiras e o ciclo da aula no MAZZI.
              </p>

            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td
              align="center"
              class="content-padding"
              style="padding:4px 48px 38px 48px;"
            >

              <a
                href="{{lesson_url}}"
                class="button"
                style="
                  display:inline-block;
                  padding:16px 28px;
                  background-color:#f6c945;
                  border-radius:14px;
                  color:#2c2f38;
                  text-decoration:none;
                  font-size:14px;
                  line-height:18px;
                  font-weight:800;
                "
              >
                Ver aula
              </a>

              <p
                style="
                  margin:17px 0 0 0;
                  color:#999991;
                  font-size:12px;
                  line-height:18px;
                "
              >
                Você também pode acompanhar sua agenda e seus ganhos pelo aplicativo MAZZI PRO.
              </p>

            </td>
          </tr>

          <!-- REFERÊNCIA -->
          <tr>
            <td
              align="center"
              style="
                padding:20px 30px;
                background-color:#24262d;
              "
            >

              <div
                style="
                  color:#999991;
                  font-size:10px;
                  line-height:14px;
                  font-weight:500;
                  letter-spacing:.5px;
                  text-transform:uppercase;
                "
              >
                Identificação da reserva
              </div>

              <div
                style="
                  margin-top:5px;
                  color:#ffffff;
                  font-family:
                    ui-monospace,
                    SFMono-Regular,
                    Menlo,
                    Monaco,
                    Consolas,
                    'Liberation Mono',
                    'Courier New',
                    monospace;
                  font-size:11px;
                  line-height:16px;
                  font-weight:500;
                "
              >
                {{booking_reference}}
              </div>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td
              align="center"
              style="
                padding:28px 30px 31px 30px;
                background-color:#191b20;
              "
            >

              <table
                role="presentation"
                cellspacing="0"
                cellpadding="0"
                border="0"
                align="center"
              >
                <tr>

                  <td valign="middle">
                    <img
                      src="{{mazzi_logo_src}}"
                      width="34"
                      height="34"
                      alt="MAZZI"
                      style="width:34px;height:34px;display:block;"
                    >
                  </td>

                  <td
                    valign="middle"
                    style="
                      padding-left:10px;
                      color:#ffffff;
                      font-size:16px;
                      line-height:18px;
                      font-weight:900;
                    "
                  >
                    MAZZI
                  </td>

                </tr>
              </table>

              <p
                style="
                  margin:16px 0 0 0;
                  color:#b8b7b2;
                  font-size:11px;
                  line-height:17px;
                "
              >
                Este é um e-mail automático relacionado a uma aula confirmada no MAZZI.
              </p>

              <p
                style="
                  margin:6px 0 0 0;
                  color:#77766f;
                  font-size:10px;
                  line-height:16px;
                "
              >
                Nunca solicitaremos sua senha, código de acesso ou dados financeiros completos por e-mail.
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`,
  'pro-payout-completed': String.raw`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Repasse realizado - MAZZI</title>

  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #1f2128;
      color: #ffffff;
      font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Arial,
        sans-serif;
    }

    table {
      border-collapse: collapse;
      border-spacing: 0;
    }

    img {
      border: 0;
      display: block;
      outline: none;
      text-decoration: none;
    }

    .container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
    }

    .button {
      display: inline-block;
      background-color: #f6c945;
      color: #2c2f38 !important;
      text-decoration: none;
      font-size: 14px;
      line-height: 18px;
      font-weight: 800;
      padding: 16px 28px;
      border-radius: 14px;
    }

    @media only screen and (max-width: 620px) {
      .outer-padding {
        padding-left: 12px !important;
        padding-right: 12px !important;
      }

      .content-padding {
        padding-left: 22px !important;
        padding-right: 22px !important;
      }

      .amount {
        font-size: 36px !important;
        line-height: 40px !important;
      }

      .button {
        display: block !important;
        text-align: center !important;
      }
    }
  </style>
</head>

<body>

  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Seu repasse foi realizado pelo MAZZI.
  </div>

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="background-color:#1f2128;"
  >
    <tr>
      <td
        align="center"
        class="outer-padding"
        style="padding:40px 20px;"
      >

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          class="container"
          style="
            width:100%;
            max-width:600px;
            background-color:#2c2f38;
            border-radius:18px;
            overflow:hidden;
          "
        >

          <!-- HEADER -->
          <tr>
            <td
              style="
                padding:22px 28px;
                background-color:#f6c945;
              "
            >
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
              >
                <tr>
                  <td width="52" valign="middle">
                    <img
                      src="{{mazzi_logo_src}}"
                      width="48"
                      height="48"
                      alt="MAZZI"
                      style="width:48px;height:48px;display:block;"
                    >
                  </td>

                  <td valign="middle" style="padding-left:12px;">
                    <div
                      style="
                        color:#2c2f38;
                        font-size:18px;
                        line-height:20px;
                        font-weight:900;
                        letter-spacing:-0.4px;
                      "
                    >
                      MAZZI
                    </div>

                    <div
                      style="
                        margin-top:3px;
                        color:#2c2f38;
                        font-size:11px;
                        line-height:15px;
                        font-weight:600;
                        opacity:.72;
                      "
                    >
                      Sua jornada, no seu ritmo.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- STATUS -->
          <tr>
            <td
              align="center"
              class="content-padding"
              style="padding:42px 48px 16px 48px;"
            >

              <div
                style="
                  width:54px;
                  height:54px;
                  line-height:54px;
                  margin:0 auto 20px auto;
                  background-color:#f6c945;
                  border-radius:16px;
                  color:#2c2f38;
                  font-size:25px;
                  font-weight:900;
                  text-align:center;
                "
              >
                ✓
              </div>

              <h1
                style="
                  margin:0;
                  color:#ffffff;
                  font-size:28px;
                  line-height:32px;
                  font-weight:800;
                  letter-spacing:-1px;
                "
              >
                Repasse realizado
              </h1>

              <p
                style="
                  margin:12px 0 0 0;
                  color:#b8b7b2;
                  font-size:16px;
                  line-height:24px;
                  font-weight:400;
                "
              >
                Olá, {{provider_first_name}}! Seu repasse foi realizado pelo MAZZI.
              </p>

            </td>
          </tr>

          <!-- VALOR REPASSADO -->
          <tr>
            <td
              align="center"
              style="padding:12px 20px 34px 20px;"
            >

              <div
                style="
                  margin-bottom:4px;
                  color:#b8b7b2;
                  font-size:12px;
                  line-height:18px;
                  font-weight:500;
                "
              >
                Valor repassado
              </div>

              <div
                class="amount"
                style="
                  color:#f6c945;
                  font-size:38px;
                  line-height:42px;
                  font-weight:800;
                  letter-spacing:-1.6px;
                "
              >
                {{payout_amount}}
              </div>

            </td>
          </tr>

          <!-- DETALHES DO REPASSE -->
          <tr>
            <td
              class="content-padding"
              style="padding:0 48px 24px 48px;"
            >

              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  width:100%;
                  background-color:#33363f;
                  border-radius:16px;
                "
              >
                <tr>
                  <td style="padding:24px;">

                    <div
                      style="
                        margin-bottom:20px;
                        color:#f6c945;
                        font-size:10px;
                        line-height:13px;
                        font-weight:700;
                        letter-spacing:1.2px;
                        text-transform:uppercase;
                      "
                    >
                      Detalhes do repasse
                    </div>

                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                    >

                      <tr>
                        <td
                          style="
                            width:42%;
                            padding:0 0 14px 0;
                            color:#aaa9a4;
                            font-size:13px;
                            line-height:19px;
                          "
                        >
                          Data do repasse
                        </td>

                        <td
                          align="right"
                          style="
                            padding:0 0 14px 12px;
                            color:#ffffff;
                            font-size:14px;
                            line-height:19px;
                            font-weight:600;
                          "
                        >
                          {{payout_date}}
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            padding:0 0 14px 0;
                            color:#aaa9a4;
                            font-size:13px;
                            line-height:19px;
                          "
                        >
                          Forma de repasse
                        </td>

                        <td
                          align="right"
                          style="
                            padding:0 0 14px 12px;
                            color:#ffffff;
                            font-size:14px;
                            line-height:19px;
                            font-weight:600;
                          "
                        >
                          {{payout_method}}
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            color:#aaa9a4;
                            font-size:13px;
                            line-height:19px;
                          "
                        >
                          Status
                        </td>

                        <td
                          align="right"
                          style="
                            padding-left:12px;
                            color:#f6c945;
                            font-size:14px;
                            line-height:19px;
                            font-weight:700;
                          "
                        >
                          Realizado
                        </td>
                      </tr>

                    </table>

                    <div style="height:22px;line-height:22px;">&nbsp;</div>

                    <!-- DESTINO DO REPASSE -->
                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                      style="
                        width:100%;
                        background-color:#24262d;
                        border-radius:14px;
                      "
                    >
                      <tr>
                        <td style="padding:18px;">

                          <div
                            style="
                              margin-bottom:9px;
                              color:#f6c945;
                              font-size:10px;
                              line-height:13px;
                              font-weight:700;
                              letter-spacing:1px;
                              text-transform:uppercase;
                            "
                          >
                            Destino do repasse
                          </div>

                          <div
                            style="
                              margin-bottom:16px;
                              color:#ffffff;
                              font-size:16px;
                              line-height:21px;
                              font-weight:800;
                            "
                          >
                            {{bank_name}}
                          </div>

                          <table
                            role="presentation"
                            width="100%"
                            cellspacing="0"
                            cellpadding="0"
                            border="0"
                          >

                            <tr>
                              <td
                                style="
                                  padding:0 0 9px 0;
                                  color:#aaa9a4;
                                  font-size:12px;
                                  line-height:18px;
                                "
                              >
                                Agência
                              </td>

                              <td
                                align="right"
                                style="
                                  padding:0 0 9px 12px;
                                  color:#ffffff;
                                  font-size:13px;
                                  line-height:18px;
                                  font-weight:600;
                                "
                              >
                                •• {{bank_branch_last2}}
                              </td>
                            </tr>

                            <tr>
                              <td
                                style="
                                  color:#aaa9a4;
                                  font-size:12px;
                                  line-height:18px;
                                "
                              >
                                Conta
                              </td>

                              <td
                                align="right"
                                style="
                                  padding-left:12px;
                                  color:#ffffff;
                                  font-size:13px;
                                  line-height:18px;
                                  font-weight:600;
                                "
                              >
                                •••• {{bank_account_last4}}
                              </td>
                            </tr>

                          </table>

                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- RESUMO FINANCEIRO -->
          <tr>
            <td
              class="content-padding"
              style="padding:8px 48px 30px 48px;"
            >

              <div
                style="
                  margin-bottom:17px;
                  color:#ffffff;
                  font-size:18px;
                  line-height:22px;
                  font-weight:800;
                "
              >
                Resumo financeiro
              </div>

              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
              >

                <tr>
                  <td
                    style="
                      padding:11px 0;
                      color:#aaa9a4;
                      border-bottom:1px solid #454851;
                      font-size:13px;
                      line-height:19px;
                    "
                  >
                    Valor bruto
                  </td>

                  <td
                    align="right"
                    style="
                      padding:11px 0;
                      color:#ffffff;
                      border-bottom:1px solid #454851;
                      font-size:14px;
                      line-height:19px;
                      font-weight:600;
                    "
                  >
                    {{gross_amount}}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:11px 0;
                      color:#aaa9a4;
                      border-bottom:1px solid #454851;
                      font-size:13px;
                      line-height:19px;
                    "
                  >
                    Taxa MAZZI
                  </td>

                  <td
                    align="right"
                    style="
                      padding:11px 0;
                      color:#ffffff;
                      border-bottom:1px solid #454851;
                      font-size:14px;
                      line-height:19px;
                      font-weight:600;
                    "
                  >
                    {{mazzi_fee_amount}}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:15px 0 0 0;
                      color:#ffffff;
                      font-size:14px;
                      line-height:20px;
                      font-weight:700;
                    "
                  >
                    Valor repassado
                  </td>

                  <td
                    align="right"
                    style="
                      padding:15px 0 0 0;
                      color:#f6c945;
                      font-size:16px;
                      line-height:20px;
                      font-weight:800;
                    "
                  >
                    {{payout_amount}}
                  </td>
                </tr>

              </table>

              <p
                style="
                  margin:22px 0 0 0;
                  color:#b8b7b2;
                  font-size:12px;
                  line-height:19px;
                "
              >
                O repasse foi processado para a conta cadastrada no MAZZI.
                Dependendo da instituição financeira, o crédito pode levar algum tempo para aparecer no saldo da conta.
              </p>

            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td
              align="center"
              class="content-padding"
              style="padding:4px 48px 38px 48px;"
            >

              <a
                href="{{earnings_url}}"
                class="button"
                style="
                  display:inline-block;
                  padding:16px 28px;
                  background-color:#f6c945;
                  border-radius:14px;
                  color:#2c2f38;
                  text-decoration:none;
                  font-size:14px;
                  line-height:18px;
                  font-weight:800;
                "
              >
                Ver meus ganhos
              </a>

              <p
                style="
                  margin:17px 0 0 0;
                  color:#999991;
                  font-size:12px;
                  line-height:18px;
                "
              >
                Você também pode acompanhar seus ganhos e repasses pelo aplicativo MAZZI PRO.
              </p>

            </td>
          </tr>

          <!-- REFERÊNCIA -->
          <tr>
            <td
              align="center"
              style="
                padding:20px 30px;
                background-color:#24262d;
              "
            >

              <div
                style="
                  color:#999991;
                  font-size:10px;
                  line-height:14px;
                  font-weight:500;
                  letter-spacing:.5px;
                  text-transform:uppercase;
                "
              >
                Identificação do repasse
              </div>

              <div
                style="
                  margin-top:5px;
                  color:#ffffff;
                  font-family:
                    ui-monospace,
                    SFMono-Regular,
                    Menlo,
                    Monaco,
                    Consolas,
                    'Liberation Mono',
                    'Courier New',
                    monospace;
                  font-size:11px;
                  line-height:16px;
                  font-weight:500;
                "
              >
                {{payout_reference}}
              </div>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td
              align="center"
              style="
                padding:28px 30px 31px 30px;
                background-color:#191b20;
              "
            >

              <table
                role="presentation"
                cellspacing="0"
                cellpadding="0"
                border="0"
                align="center"
              >
                <tr>

                  <td valign="middle">
                    <img
                      src="{{mazzi_logo_src}}"
                      width="34"
                      height="34"
                      alt="MAZZI"
                      style="width:34px;height:34px;display:block;"
                    >
                  </td>

                  <td
                    valign="middle"
                    style="
                      padding-left:10px;
                      color:#ffffff;
                      font-size:16px;
                      line-height:18px;
                      font-weight:900;
                    "
                  >
                    MAZZI
                  </td>

                </tr>
              </table>

              <p
                style="
                  margin:16px 0 0 0;
                  color:#b8b7b2;
                  font-size:11px;
                  line-height:17px;
                "
              >
                Este é um e-mail automático relacionado a um repasse realizado no MAZZI.
              </p>

              <p
                style="
                  margin:6px 0 0 0;
                  color:#77766f;
                  font-size:10px;
                  line-height:16px;
                "
              >
                Nunca solicitaremos sua senha, código de acesso ou dados bancários completos por e-mail.
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`,
} as const;
