{if $ssolink}
  <a class='btn btn-default' href='{$ssolink}' target='_blank'>Log in to Control Panel</a>
{/if}

{if $website}
  <a class='btn btn-default' href='http{($sslStatus && $sslStatus.active) ? 's' : ''}://{$website}' target='_blank'>Visit Website</a>
{/if}

{if $iconlinks && $ssolink}
  <div class="container my-4">
    <div class="row g-3">
      {foreach $iconlinks as $link}
        <div class="col-12 col-sm-6 col-md-4 col-lg-3 text-center mb-4">
          <a href="{$ssolink}&amp;quicklink={$link.quicklink}" class="text-decoration-none text-dark" target="_blank" id="{$link.quicklink}">
            <img src="{$link.icon}" alt="{$link.label}" style="max-width: 50%; height: auto;" />
            <div>{$link.label}</div>
          </a>
        </div>
      {/foreach}
    </div>
  </div>
{/if}
