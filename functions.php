<?php
// tell spf-init where the theme's js files are located
function set_js_globals() {
    $root = get_stylesheet_directory_uri();
    $upload_dir = wp_upload_dir()['baseurl'];
    print "<script>window.spf = {animationDir:\"" . $upload_dir . "/\", scriptDir:\"" . $root . "/js/\"}</script>\n";
}
add_action('wp_head', 'set_js_globals', 1);

add_action( 'wp_enqueue_scripts', 'enqueue_scripts' );
function enqueue_scripts() {
    $version = wp_get_theme()->get('Version');
    $parent_style = 'parent-style';
    $root = get_stylesheet_directory_uri();

    wp_enqueue_style( $parent_style, get_template_directory_uri() . '/style.css' );
    wp_enqueue_style( 'child-style',
        $root . '/style.css',
        array( $parent_style ),
        $version
    );
    wp_enqueue_style( 'spf-ui',
        $root . '/css/spf-ui.css',
        array(),
        $version
    );
    wp_enqueue_script( 'yepnope',
        $root . '/js/yepnope.js',
        array(),
        $version
    );
    wp_enqueue_script( 'spf-init',
        $root . '/js/spf-init.js',
        array( 'yepnope', 'jquery' ),
        $version
    );

}

// allow unfiltered uploads for some roles
define( 'ALLOW_UNFILTERED_UPLOADS', true );
?>
