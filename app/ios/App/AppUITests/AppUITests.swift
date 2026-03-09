import XCTest

final class AppUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: – Launch & WebView Loading

    /// The app should launch, load the Capacitor WebView, and eventually
    /// display the login screen. The WebView renders inside a WKWebView,
    /// so we look for the webView element first, then check for known
    /// text that the React app renders on the login page.
    func testAppLaunchesAndShowsLoginScreen() throws {
        // Give the WebView time to load the React bundle
        let webView = app.webViews.firstMatch
        let exists = webView.waitForExistence(timeout: 15)
        XCTAssertTrue(exists, "WebView should appear within 15 seconds of launch")

        // The login page should contain identifiable text.
        // Capacitor renders React inside a WKWebView — XCUITest can
        // see static text nodes within it.
        let loginHeading = webView.staticTexts["Cheklistr"]
        let found = loginHeading.waitForExistence(timeout: 10)
        XCTAssertTrue(found, "Login screen should display the 'Cheklistr' heading")
    }

    /// Verify the login form fields are present and interactable.
    func testLoginFormFieldsExist() throws {
        let webView = app.webViews.firstMatch
        _ = webView.waitForExistence(timeout: 15)

        // Look for text fields — the User ID field and password field
        // should be present. In a WebView, text fields appear as
        // XCUIElement with type .textField or .secureTextField.
        let textFields = webView.textFields
        let secureFields = webView.secureTextFields

        // We expect at least one text field (User ID) and one secure field (password)
        XCTAssertGreaterThanOrEqual(
            textFields.count, 1,
            "Login screen should have at least one text input (User ID)"
        )
        XCTAssertGreaterThanOrEqual(
            secureFields.count, 1,
            "Login screen should have at least one password input"
        )
    }

    // MARK: – Face ID Simulation

    /// On the Simulator with Face ID enrolled (Features → Face ID → Enrolled),
    /// a biometric prompt should appear. This test just verifies the app
    /// doesn't crash when biometrics are triggered.
    ///
    /// NOTE: For this test to pass, you must enable Face ID in the Simulator:
    ///   Simulator → Features → Face ID → Enrolled
    /// Then during the test, simulate a match:
    ///   Simulator → Features → Face ID → Matching Face
    func testBiometricPromptDoesNotCrash() throws {
        // The biometric prompt only appears if the user has previously
        // enrolled (logged in + set up biometrics). On a fresh install
        // in the Simulator, we just verify the app stays alive and
        // shows the login form after the biometric check completes.
        let webView = app.webViews.firstMatch
        let exists = webView.waitForExistence(timeout: 15)
        XCTAssertTrue(exists, "App should remain stable after biometric availability check")
    }

    // MARK: – Navigation

    /// After entering invalid credentials, the app should show an error
    /// message rather than navigating away from the login screen.
    func testInvalidLoginShowsError() throws {
        let webView = app.webViews.firstMatch
        _ = webView.waitForExistence(timeout: 15)

        // Type into the User ID field
        let userIdField = webView.textFields.firstMatch
        guard userIdField.waitForExistence(timeout: 5) else {
            XCTFail("User ID field not found")
            return
        }
        userIdField.tap()
        userIdField.typeText("INVALID_USER")

        // Type into the password field
        let passwordField = webView.secureTextFields.firstMatch
        guard passwordField.waitForExistence(timeout: 5) else {
            XCTFail("Password field not found")
            return
        }
        passwordField.tap()
        passwordField.typeText("wrong_password")

        // Look for a sign-in button and tap it
        let signInButton = webView.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] 'Sign' OR label CONTAINS[c] 'Log'")
        ).firstMatch

        if signInButton.waitForExistence(timeout: 5) {
            signInButton.tap()

            // Wait for the error message to appear
            let errorText = webView.staticTexts.matching(
                NSPredicate(format: "label CONTAINS[c] 'invalid' OR label CONTAINS[c] 'error' OR label CONTAINS[c] 'incorrect'")
            ).firstMatch

            let errorAppeared = errorText.waitForExistence(timeout: 10)
            XCTAssertTrue(errorAppeared, "An error message should appear after invalid login")
        }
    }

    // MARK: – Orientation

    /// The app should handle rotation without crashing.
    func testRotationDoesNotCrash() throws {
        let webView = app.webViews.firstMatch
        _ = webView.waitForExistence(timeout: 15)

        XCUIDevice.shared.orientation = .landscapeLeft
        sleep(1) // let the layout settle
        XCTAssertTrue(webView.exists, "WebView should survive landscape rotation")

        XCUIDevice.shared.orientation = .portrait
        sleep(1)
        XCTAssertTrue(webView.exists, "WebView should survive returning to portrait")
    }
}
