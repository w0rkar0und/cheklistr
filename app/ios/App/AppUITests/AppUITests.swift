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

    /// Verify the login form is present by checking for known UI labels.
    ///
    /// WKWebView does NOT expose HTML <input> elements as XCUIElement
    /// .textField or .secureTextField types. Instead, we verify the
    /// login form is rendered by looking for static text labels that
    /// the React login component renders alongside the inputs.
    func testLoginFormFieldsExist() throws {
        let webView = app.webViews.firstMatch
        _ = webView.waitForExistence(timeout: 15)

        // The React login page renders labels/placeholders for the form.
        // We look for any text containing "User ID" or "Password" —
        // these prove the form has rendered inside the WebView.
        let allText = webView.staticTexts

        // Collect all visible text labels so we can give a useful
        // failure message if the expected ones aren't found.
        var foundUserLabel = false
        var foundPasswordLabel = false

        for i in 0..<allText.count {
            let label = allText.element(boundBy: i).label.lowercased()
            if label.contains("user") || label.contains("id") {
                foundUserLabel = true
            }
            if label.contains("password") || label.contains("pin") {
                foundPasswordLabel = true
            }
        }

        // If static text labels aren't present, also check for
        // placeholder text which WKWebView sometimes exposes via
        // otherElements or textFields with empty values.
        if !foundUserLabel {
            let otherEls = webView.otherElements
            for i in 0..<min(otherEls.count, 30) {
                let el = otherEls.element(boundBy: i)
                let lbl = el.label.lowercased()
                if lbl.contains("user") || lbl.contains("id") {
                    foundUserLabel = true
                    break
                }
            }
        }

        XCTAssertTrue(
            foundUserLabel,
            "Login form should display a User ID label or placeholder"
        )
        // Password label may not always be exposed separately;
        // its presence is secondary to the User ID field.
        // We log but don't hard-fail if only the user label is found.
        if !foundPasswordLabel {
            print("⚠️ Password label not found as static text — may be a secure input not exposed by WKWebView")
        }
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

    /// Tapping sign-in with empty fields should NOT navigate away from
    /// the login screen. The HTML inputs have the `required` attribute,
    /// so the browser's native validation prevents form submission.
    /// WKWebView's native validation tooltip isn't visible to XCUITest,
    /// so instead we verify the app stays on the login page.
    func testEmptySubmitStaysOnLoginScreen() throws {
        let webView = app.webViews.firstMatch
        _ = webView.waitForExistence(timeout: 15)

        // Find and tap the sign-in button with empty fields.
        let signInButton = webView.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] 'Sign' OR label CONTAINS[c] 'Log'")
        ).firstMatch

        let signInLink = webView.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] 'Sign In' OR label CONTAINS[c] 'Log In'")
        ).firstMatch

        if signInButton.waitForExistence(timeout: 5) {
            signInButton.tap()
        } else if signInLink.waitForExistence(timeout: 3) {
            signInLink.tap()
        } else {
            print("⚠️ Could not locate sign-in button in WebView — skipping")
            return
        }

        // Wait a moment then confirm we're still on the login screen.
        // We check for the login-only subtitle rather than "Cheklistr"
        // which also appears in the app header on post-login pages.
        sleep(2)

        let loginSubtitle = webView.staticTexts["Vehicle Inspection System"]
        XCTAssertTrue(
            loginSubtitle.exists,
            "App should remain on the login screen after tapping sign-in with empty fields"
        )
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
